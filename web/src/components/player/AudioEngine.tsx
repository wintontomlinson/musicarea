'use client';

import { useEffect, useRef } from 'react';
import { Howl, Howler } from 'howler';
import { usePlayer } from '@/stores/player';
import { useLibrary } from '@/stores/library';
import type { Song } from '@/lib/types';
import { pickStreamUrl } from '@/lib/utils';

/**
 * The audio engine. A single always-mounted component that owns the Howl
 * instance and keeps it in sync with the player store: it loads whatever the
 * store says is current, honors play/pause, volume and mute, reports progress
 * on a timer, and advances the queue when a track ends.
 *
 * Rendering nothing, it exists purely for its effects.
 *
 * The store is the source of truth for *intent* and the engine is the source of
 * truth for *position*. Those travel in opposite directions and must not share
 * a channel: `setProgress` only ever flows engine to store, and a seek only ever
 * arrives as a `seekSeq` bump. An earlier version inferred seeks by diffing
 * `currentTime`, which could not express "seek to 0:00" at all and had to guess
 * with a tolerance window.
 */

/**
 * How many unplayable tracks to skip past before giving up. Without a ceiling, a
 * queue where nothing resolves (offline, or a region-blocked set of streams)
 * spins forever with `repeat: 'all'`: each failure calls next(), which loads,
 * which fails.
 */
const MAX_CONSECUTIVE_FAILURES = 5;

export function AudioEngine() {
  const howlRef = useRef<Howl | null>(null);
  const tickRef = useRef<number | null>(null);
  // The song id currently loaded into Howler, to detect real track changes.
  const loadedIdRef = useRef<string | null>(null);
  // Bumped on every load. An in-flight load whose ticket is stale must not
  // create a Howl: React strict mode mounts effects twice, and a fast track
  // change can also overtake the `await` on stream-URL resolution. Without this
  // two Howls end up playing and only one of them is reachable to stop.
  const loadTicketRef = useRef(0);
  const failuresRef = useRef(0);

  useEffect(() => {
    function stopTicker() {
      if (tickRef.current !== null) {
        window.clearInterval(tickRef.current);
        tickRef.current = null;
      }
    }

    /**
     * Report playback position on an interval rather than requestAnimationFrame.
     * rAF is suspended entirely while a tab is backgrounded or the screen is
     * locked, which would freeze the progress bar and the OS lock-screen
     * scrubber even though the audio keeps playing. Timers keep firing
     * (throttled to about a second in the background), so the position stays
     * truthful.
     */
    function startTicker() {
      stopTicker();
      tickRef.current = window.setInterval(() => {
        const howl = howlRef.current;
        if (!howl || !howl.playing()) return;
        const raw = howl.seek();
        const time = typeof raw === 'number' ? raw : 0;
        const dur = howl.duration() || 0;
        const { currentTime } = usePlayer.getState();
        // Only write when it actually moved, to avoid needless renders.
        if (Math.abs(time - currentTime) >= 0.25) {
          usePlayer.getState().setProgress(time, dur);
        }
      }, 250);
    }

    async function resolveUrl(song: Song): Promise<string | null> {
      const direct = pickStreamUrl(song);
      if (direct) return direct;
      // The song lacked stream URLs (e.g. a slim record); fetch full details.
      try {
        const res = await fetch(`/api/song/${encodeURIComponent(song.id)}`);
        if (!res.ok) return null;
        const full = (await res.json()) as Song[] | { data?: Song[] };
        const list = Array.isArray(full) ? full : full.data;
        return list && list[0] ? pickStreamUrl(list[0]) : null;
      } catch {
        return null;
      }
    }

    /** Give up after too many unplayable tracks in a row. */
    function bailOut() {
      failuresRef.current = 0;
      const s = usePlayer.getState();
      s.setLoading(false);
      s.setPlaying(false);
      s.setPlaybackError(
        'Nothing in this queue could be streamed. Check your connection and try again.',
      );
    }

    function handleFailure() {
      failuresRef.current += 1;
      const { queue } = usePlayer.getState();
      const limit = Math.min(MAX_CONSECUTIVE_FAILURES, Math.max(1, queue.length));
      if (failuresRef.current >= limit) {
        bailOut();
        return;
      }
      usePlayer.getState().next(true);
    }

    async function loadAndPlay(song: Song | null) {
      const ticket = ++loadTicketRef.current;

      // Tear down any existing sound.
      stopTicker();
      if (howlRef.current) {
        howlRef.current.unload();
        howlRef.current = null;
      }
      loadedIdRef.current = song?.id ?? null;
      if (!song) return;

      usePlayer.getState().setLoading(true);
      const url = await resolveUrl(song);
      // A newer load (or the effect's own teardown) superseded this one.
      if (loadTicketRef.current !== ticket) return;

      if (!url) {
        usePlayer.getState().setLoading(false);
        handleFailure();
        return;
      }

      const howl = new Howl({
        src: [url],
        // Stream through an HTML5 audio element rather than the Web Audio graph.
        // Required for long AAC files, and it is what lets playback continue
        // when the tab is backgrounded or the phone screen locks.
        html5: true,
        format: ['mp4', 'aac', 'm4a'],
        // No per-sound `volume` here on purpose. Howler multiplies the master
        // gain by each sound's own gain, so setting both to the store's volume
        // squared it and every track played quieter than the slider claimed
        // (0.85 became 0.72). `Howler.volume()` below is the single control.
        onload: () => {
          failuresRef.current = 0;
          const s = usePlayer.getState();
          s.setLoading(false);
          s.setPlaybackError(null);
          s.setProgress(0, howl.duration() || 0);
        },
        onplay: () => {
          usePlayer.getState().setPlaying(true);
          // Recorded here rather than on load, so skipping through a queue does
          // not fill the recent list with tracks nobody heard.
          useLibrary.getState().recordPlay(song);
          startTicker();
        },
        onpause: () => {
          usePlayer.getState().setPlaying(false);
          stopTicker();
        },
        onend: () => {
          stopTicker();
          usePlayer.getState().next(true);
        },
        onloaderror: () => {
          usePlayer.getState().setLoading(false);
          handleFailure();
        },
        onplayerror: () => {
          // Autoplay can be blocked until a user gesture; Howler recovers on
          // unlock.
          howl.once('unlock', () => {
            if (usePlayer.getState().isPlaying) howl.play();
          });
        },
      });
      howlRef.current = howl;

      if (usePlayer.getState().isPlaying) howl.play();
    }

    // Subscribe imperatively so we react to store changes without re-rendering.
    const unsub = usePlayer.subscribe((state, prev) => {
      const track = state.currentTrack();

      // A different track is current: load it.
      if (track?.id !== loadedIdRef.current) {
        void loadAndPlay(track);
        return;
      }

      const howl = howlRef.current;
      if (!howl) return;

      // An explicit seek (or a repeat-one replay, which is a seek to 0 plus a
      // request to be playing).
      if (state.seekSeq !== prev.seekSeq) {
        howl.seek(state.currentTime);
        if (state.isPlaying && !howl.playing()) howl.play();
        return;
      }

      // Play/pause toggled.
      if (state.isPlaying !== prev.isPlaying) {
        if (state.isPlaying && !howl.playing()) howl.play();
        else if (!state.isPlaying && howl.playing()) howl.pause();
      }

      // Volume / mute changed.
      if (state.volume !== prev.volume || state.muted !== prev.muted) {
        Howler.volume(state.muted ? 0 : state.volume);
      }
    });

    // Apply initial volume.
    const s = usePlayer.getState();
    Howler.volume(s.muted ? 0 : s.volume);
    // If a track is already set (e.g. fast navigation), load it.
    const initial = s.currentTrack();
    if (initial) void loadAndPlay(initial);

    return () => {
      unsub();
      stopTicker();
      // Invalidate any in-flight load so it cannot create an orphaned Howl
      // after teardown.
      loadTicketRef.current += 1;
      howlRef.current?.unload();
      howlRef.current = null;
      loadedIdRef.current = null;
    };
  }, []);

  return null;
}
