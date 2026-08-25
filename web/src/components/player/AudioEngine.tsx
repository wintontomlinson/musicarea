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
 * on a rAF loop, and advances the queue when a track ends.
 *
 * Rendering nothing, it exists purely for its effects.
 */
export function AudioEngine() {
  const howlRef = useRef<Howl | null>(null);
  const rafRef = useRef<number | null>(null);
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

      // Seek requested from UI: currentTime jumped while the same track plays
      // and the delta is larger than the rAF tick would produce.
      if (
        howlRef.current &&
        track &&
        track.id === prevTrack?.id &&
        Math.abs(state.currentTime - prev.currentTime) > 1.2 &&
        state.currentTime > 0
      ) {
        howlRef.current.seek(state.currentTime);
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
      stopRaf();
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
    stopRaf();
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
      html5: true, // stream rather than fully buffer; required for long AAC files
      format: ['mp4', 'aac', 'm4a'],
      volume: usePlayer.getState().muted ? 0 : usePlayer.getState().volume,
      onload: () => {
        usePlayer.getState().setLoading(false);
        usePlayer.getState().setProgress(0, howl.duration() || 0);
      },
      onplay: () => {
        usePlayer.getState().setPlaying(true);
        startRaf();
      },
      onpause: () => {
        usePlayer.getState().setPlaying(false);
        stopRaf();
      },
      onend: () => {
        stopRaf();
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

  function startRaf() {
    stopRaf();
    const tick = () => {
      const howl = howlRef.current;
      if (howl && howl.playing()) {
        const t = howl.seek();
        const time = typeof t === 'number' ? t : 0;
        const dur = howl.duration() || 0;
        const { currentTime } = usePlayer.getState();
        // Only write when it actually moved, to avoid needless renders.
        if (Math.abs(time - currentTime) >= 0.25) {
          usePlayer.getState().setProgress(time, dur);
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }

  function stopRaf() {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }

  return null;
}
