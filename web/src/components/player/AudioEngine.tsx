'use client';

import { useEffect, useRef } from 'react';
import { Howl, Howler } from 'howler';
import { usePlayer } from '@/stores/player';
import { useLibrary } from '@/stores/library';
import { useHistory } from '@/stores/history';
import type { Song } from '@/lib/types';
import { pickStream, type ChosenStream } from '@/lib/utils';

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

/**
 * Seconds of playback before a track counts as a `play` for the taste profile.
 * Logging on load would let a scroll through a shelf rewrite someone's taste,
 * so a play has to survive the intro first.
 */
const PLAY_THRESHOLD_SECONDS = 12;

/** Fraction of a track that must be heard for the end to count as a `complete`. */
const COMPLETE_RATIO = 0.9;

export function AudioEngine() {
  const howlRef = useRef<Howl | null>(null);
  const tickRef = useRef<number | null>(null);
  // The song id currently loaded into Howler, to detect real track changes.
  const loadedIdRef = useRef<string | null>(null);
  // Furthest point reached in the current track, used to decide whether its end
  // was a genuine listen. Tracked rather than read at `onend`, where the
  // position has already been reset.
  const maxProgressRef = useRef(0);
  // A play is logged once per load, not once per tick.
  const playLoggedRef = useRef(false);
  // Bumped on every load. An in-flight load whose ticket is stale must not
  // create a Howl: React strict mode mounts effects twice, and a fast track
  // change can also overtake the `await` on stream-URL resolution. Without this
  // two Howls end up playing and only one of them is reachable to stop.
  const loadTicketRef = useRef(0);
  const failuresRef = useRef(0);
  // Position to restore once a reloaded source reports its duration. Set when the
  // quality preference changes mid-track.
  const resumeAtRef = useRef<number | null>(null);

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
        if (time > maxProgressRef.current) maxProgressRef.current = time;

        // A play counts once the intro is past. This is the single most common
        // event feeding the taste profile.
        if (!playLoggedRef.current && time >= PLAY_THRESHOLD_SECONDS) {
          playLoggedRef.current = true;
          const track = usePlayer.getState().currentTrack();
          if (track) useHistory.getState().log(track, 'play');
        }

        const { currentTime } = usePlayer.getState();
        // Only write when it actually moved, to avoid needless renders.
        if (Math.abs(time - currentTime) >= 0.25) {
          usePlayer.getState().setProgress(time, dur);
        }
      }, 250);
    }

    async function resolveStream(song: Song): Promise<ChosenStream | null> {
      const requested = usePlayer.getState().quality;
      const direct = pickStream(song, requested);
      if (direct) return direct;
      // The song lacked stream URLs (e.g. a slim record); fetch full details.
      try {
        const res = await fetch(`/api/song/${encodeURIComponent(song.id)}`);
        if (!res.ok) return null;
        const full = (await res.json()) as Song[] | { data?: Song[] };
        const list = Array.isArray(full) ? full : full.data;
        return list && list[0] ? pickStream(list[0], requested) : null;
      } catch {
        return null;
      }
    }

    /**
     * Record how a track finished. A track heard through to the end is a much
     * stronger taste signal than one that merely started, and a replay under
     * repeat-one is stronger still, so the three are logged as different events.
     */
    function logEnd(song: Song, duration: number) {
      const ratio = duration > 0 ? maxProgressRef.current / duration : 0;
      const { repeat } = usePlayer.getState();
      if (repeat === 'one') {
        useHistory.getState().log(song, 'repeat');
        return;
      }
      useHistory.getState().log(song, ratio >= COMPLETE_RATIO ? 'complete' : 'play');
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

    async function loadAndPlay(song: Song | null, opts: { sameTrack?: boolean } = {}) {
      const ticket = ++loadTicketRef.current;

      // Tear down any existing sound.
      stopTicker();
      if (howlRef.current) {
        howlRef.current.unload();
        howlRef.current = null;
      }
      loadedIdRef.current = song?.id ?? null;
      // Reloading the same source (a quality change) keeps the listening stats it
      // has already accumulated; a genuinely new track starts them over.
      if (!opts.sameTrack) {
        maxProgressRef.current = 0;
        playLoggedRef.current = false;
      }
      if (!song) return;

      usePlayer.getState().setLoading(true);
      const stream = await resolveStream(song);
      // A newer load (or the effect's own teardown) superseded this one.
      if (loadTicketRef.current !== ticket) return;

      if (!stream) {
        usePlayer.getState().setLoading(false);
        usePlayer.getState().setActiveStream(null, false);
        handleFailure();
        return;
      }
      const url = stream.url;

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
          s.setActiveStream(stream.quality, stream.steppedDown);

          // Restore the position after a quality change. The seek has to wait
          // until the new source reports a duration: assigning a time to a media
          // element still in HAVE_NOTHING is silently dropped, so doing it any
          // earlier would look like it worked and restart the track instead.
          const resumeAt = resumeAtRef.current;
          resumeAtRef.current = null;
          const duration = howl.duration() || 0;
          if (resumeAt && resumeAt > 0 && resumeAt < duration) {
            howl.seek(resumeAt);
            s.setProgress(resumeAt, duration);
          } else {
            s.setProgress(0, duration);
          }
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
          logEnd(song, howl.duration() || 0);
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

      // The quality preference changed. Reload this track at the new rung and
      // pick the listener up where they were, rather than making them lose their
      // place to change a setting.
      if (state.quality !== prev.quality && track) {
        const raw = howlRef.current?.seek();
        resumeAtRef.current = typeof raw === 'number' ? raw : null;
        // Same track, so the listening it has already earned stands: a reload
        // must not let the 12-second threshold log a second play for it.
        void loadAndPlay(track, { sameTrack: true });
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
