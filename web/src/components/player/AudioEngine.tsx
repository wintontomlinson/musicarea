'use client';

import { useEffect, useRef } from 'react';
import { Howl, Howler } from 'howler';
import { usePlayer } from '@/stores/player';
import type { Song } from '@/lib/types';
import { pickStreamUrl } from '@/lib/utils';

/**
 * The audio engine. A single always-mounted component that owns the Howl
 * instance and keeps it in sync with the player store: it loads whatever the
 * store says is current, honors play/pause, volume and mute, reports progress
 * on a timer, and advances the queue when a track ends.
 *
 * Rendering nothing, it exists purely for its effects.
 */
export function AudioEngine() {
  const howlRef = useRef<Howl | null>(null);
  const tickRef = useRef<number | null>(null);
  // The song id currently loaded into Howler, to detect real track changes.
  const loadedIdRef = useRef<string | null>(null);

  useEffect(() => {
    // Subscribe imperatively so we react to store changes without re-rendering.
    const unsub = usePlayer.subscribe((state, prev) => {
      const track = state.currentTrack();
      const prevTrack = prev.currentTrack();

      // Track changed (or a repeat-one restart nudged currentTime to 0 while the
      // id is unchanged and playback is meant to continue).
      if (track?.id !== loadedIdRef.current) {
        void loadAndPlay(track);
        return;
      }

      // repeat-one restart: same track, currentTime forced to 0, still playing.
      if (
        track &&
        track.id === prevTrack?.id &&
        state.currentTime === 0 &&
        prev.currentTime > 1 &&
        state.isPlaying &&
        howlRef.current
      ) {
        howlRef.current.seek(0);
        if (!howlRef.current.playing()) howlRef.current.play();
        return;
      }

      // Play/pause toggled.
      if (state.isPlaying !== prev.isPlaying && howlRef.current) {
        if (state.isPlaying && !howlRef.current.playing()) howlRef.current.play();
        else if (!state.isPlaying && howlRef.current.playing()) howlRef.current.pause();
      }

      // Volume / mute changed.
      if (state.volume !== prev.volume || state.muted !== prev.muted) {
        Howler.volume(state.muted ? 0 : state.volume);
      }

      // Seek requested from the UI. This compares the store against where the
      // audio actually is, not against the previous store value: a background
      // tab throttles the progress timer, so a resumed tick can legitimately
      // jump several seconds, and comparing store-to-store would misread that
      // as a seek and force a needless re-buffer of the stream.
      if (howlRef.current && track && track.id === prevTrack?.id && state.currentTime > 0) {
        const raw = howlRef.current.seek();
        const actual = typeof raw === 'number' ? raw : 0;
        if (Math.abs(state.currentTime - actual) > 1.2) {
          howlRef.current.seek(state.currentTime);
        }
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
      howlRef.current?.unload();
      howlRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  async function loadAndPlay(song: Song | null) {
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
    // The current track may have changed while awaiting; bail if so.
    if (usePlayer.getState().currentTrack()?.id !== song.id) return;

    if (!url) {
      usePlayer.getState().setLoading(false);
      // Skip forward on an unplayable track so the queue does not stall.
      usePlayer.getState().next(true);
      return;
    }

    const howl = new Howl({
      src: [url],
      // Stream through an HTML5 audio element rather than the Web Audio graph.
      // Required for long AAC files, and it is what lets playback continue when
      // the tab is backgrounded or the phone screen locks.
      html5: true,
      format: ['mp4', 'aac', 'm4a'],
      volume: usePlayer.getState().muted ? 0 : usePlayer.getState().volume,
      onload: () => {
        usePlayer.getState().setLoading(false);
        usePlayer.getState().setProgress(0, howl.duration() || 0);
      },
      onplay: () => {
        usePlayer.getState().setPlaying(true);
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
        usePlayer.getState().next(true);
      },
      onplayerror: () => {
        // Autoplay can be blocked until a user gesture; Howler recovers on unlock.
        howl.once('unlock', () => {
          if (usePlayer.getState().isPlaying) howl.play();
        });
      },
    });
    howlRef.current = howl;

    if (usePlayer.getState().isPlaying) howl.play();
  }

  /**
   * Report playback position on an interval rather than requestAnimationFrame.
   * rAF is suspended entirely while a tab is backgrounded or the screen is
   * locked, which would freeze the progress bar and the OS lock-screen scrubber
   * even though the audio keeps playing. Timers keep firing (throttled to about
   * a second in the background), so the position stays truthful.
   *
   * 250ms is no coarser than the old loop in practice: setProgress ignores
   * moves under 0.25s, so rAF was already collapsing to roughly this rate.
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

  function stopTicker() {
    if (tickRef.current !== null) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }

  return null;
}
