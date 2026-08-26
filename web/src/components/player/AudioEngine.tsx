'use client';

import { useEffect, useRef } from 'react';
import { Howl, Howler } from 'howler';
import { usePlayer } from '@/stores/player';
import type { Song } from '@/lib/types';
import { pickStreamUrl } from '@/lib/utils';

/**
 * The audio engine.
 *
 * One always-mounted component owns the single Howl instance for the whole
 * application, which is what allows playback to continue across navigation.
 * It subscribes to the player store imperatively, so a progress tick never
 * re-renders a page.
 *
 * Audio is loaded lazily: selecting a track does not fetch a stream until
 * playback is actually requested. That matters on first paint, where the queue
 * from the previous session is restored in a paused state and should cost
 * nothing until the listener presses play.
 */
export function AudioEngine() {
  const howlRef = useRef<Howl | null>(null);
  const tickRef = useRef<number | null>(null);
  /** The song id currently loaded into Howler, to detect real track changes. */
  const loadedIdRef = useRef<string | null>(null);
  /** Consecutive unplayable tracks, to stop rather than race through a queue. */
  const failuresRef = useRef(0);

  useEffect(() => {
    const store = usePlayer.getState();

    // Bring back the previous session's queue, paused.
    store.restoreQueue();
    Howler.volume(store.muted ? 0 : store.volume);
    loadedIdRef.current = store.currentTrack()?.id ?? null;

    const unsubscribe = usePlayer.subscribe((state, previous) => {
      const track = state.currentTrack();
      const previousTrack = previous.currentTrack();

      // A different track is selected.
      if (track?.id !== loadedIdRef.current) {
        if (state.isPlaying) {
          void loadAndPlay(track);
        } else {
          // Selected but not playing: drop any loaded audio, load on demand.
          teardown();
          loadedIdRef.current = track?.id ?? null;
        }
        return;
      }

      // Playback requested for a track that has not been loaded yet, which is
      // the case after a restored session or a paused selection.
      if (state.isPlaying && !howlRef.current && track) {
        void loadAndPlay(track);
        return;
      }

      // Repeat-one restart: same track, position forced back to zero.
      if (
        track &&
        track.id === previousTrack?.id &&
        state.currentTime === 0 &&
        previous.currentTime > 1 &&
        state.isPlaying &&
        howlRef.current
      ) {
        howlRef.current.seek(0);
        if (!howlRef.current.playing()) howlRef.current.play();
        return;
      }

      // Play or pause toggled.
      if (state.isPlaying !== previous.isPlaying && howlRef.current) {
        if (state.isPlaying && !howlRef.current.playing()) howlRef.current.play();
        else if (!state.isPlaying && howlRef.current.playing()) howlRef.current.pause();
      }

      // Volume or mute changed.
      if (state.volume !== previous.volume || state.muted !== previous.muted) {
        Howler.volume(state.muted ? 0 : state.volume);
      }

      // Seek requested from the interface.
      //
      // This compares the store against where the audio actually is, not against
      // the previous store value: a background tab throttles the progress timer,
      // so a resumed tick can legitimately jump several seconds, and a
      // store-to-store comparison would misread that as a seek and force a
      // needless re-buffer of the stream.
      if (howlRef.current && track && track.id === previousTrack?.id && state.currentTime > 0) {
        const raw = howlRef.current.seek();
        const actual = typeof raw === 'number' ? raw : 0;
        if (Math.abs(state.currentTime - actual) > 1.2) {
          howlRef.current.seek(state.currentTime);
        }
      }
    });

    return () => {
      unsubscribe();
      teardown();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function teardown() {
    stopTicker();
    if (howlRef.current) {
      howlRef.current.unload();
      howlRef.current = null;
    }
  }

  /**
   * Resolve a playable URL. Slim records from browse and search rows carry no
   * stream URLs, so those are resolved through the server proxy on demand.
   */
  async function resolveUrl(song: Song, signal?: AbortSignal): Promise<string | null> {
    const direct = pickStreamUrl(song);
    if (direct) return direct;

    try {
      const res = await fetch(`/api/song/${encodeURIComponent(song.id)}`, { signal });
      if (!res.ok) return null;
      const payload = (await res.json()) as Song[] | { data?: Song[] };
      const list = Array.isArray(payload) ? payload : payload.data;
      return list?.[0] ? pickStreamUrl(list[0]) : null;
    } catch {
      return null;
    }
  }

  /** Give up on the queue instead of skipping through every remaining track. */
  function failTrack(song: Song, message: string) {
    const state = usePlayer.getState();
    failuresRef.current += 1;
    state.setLoading(false);

    const limit = Math.min(Math.max(state.queue.length, 1), 4);
    if (failuresRef.current >= limit) {
      failuresRef.current = 0;
      state.setPlaying(false);
      state.setError(message);
      return;
    }
    state.next(true);
  }

  async function loadAndPlay(song: Song | null) {
    teardown();
    loadedIdRef.current = song?.id ?? null;
    if (!song) return;

    const store = usePlayer.getState();
    store.setLoading(true);
    store.setError(null);

    const url = await resolveUrl(song);

    // The selection may have moved on while the URL was being resolved.
    if (usePlayer.getState().currentTrack()?.id !== song.id) return;

    if (!url) {
      failTrack(song, `${song.name} is not available to stream right now.`);
      return;
    }

    const howl = new Howl({
      src: [url],
      // Stream through an HTML5 audio element rather than the Web Audio graph.
      // Required for long AAC files, and it is what allows playback to continue
      // when the tab is backgrounded or the phone screen locks.
      html5: true,
      format: ['mp4', 'aac', 'm4a'],
      volume: store.muted ? 0 : store.volume,
      onload: () => {
        const state = usePlayer.getState();
        state.setLoading(false);
        state.setProgress(0, howl.duration() || 0);
      },
      onplay: () => {
        failuresRef.current = 0;
        const state = usePlayer.getState();
        state.setPlaying(true);
        state.setError(null);
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
        failTrack(song, `Could not load ${song.name}. The source may be unavailable.`);
      },
      onplayerror: () => {
        // Autoplay is commonly blocked until a user gesture; Howler fires
        // "unlock" once the browser allows audio, so resume there instead of
        // treating this as a failed track.
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
   *
   * rAF is suspended entirely while a tab is backgrounded or the screen is
   * locked, which would freeze both the progress bar and the operating system
   * scrubber even though audio keeps playing. Timers keep firing, throttled to
   * roughly a second in the background, so the reported position stays truthful.
   */
  function startTicker() {
    stopTicker();
    tickRef.current = window.setInterval(() => {
      const howl = howlRef.current;
      if (!howl || !howl.playing()) return;
      const raw = howl.seek();
      const time = typeof raw === 'number' ? raw : 0;
      const duration = howl.duration() || 0;
      const { currentTime } = usePlayer.getState();
      // Only write when the position actually moved, to avoid needless renders.
      if (Math.abs(time - currentTime) >= 0.25) {
        usePlayer.getState().setProgress(time, duration);
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
