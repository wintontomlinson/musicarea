'use client';

import { useEffect, useRef } from 'react';
import { usePlayer } from '@/stores/player';
import type { Song } from '@/lib/types';

/**
 * Keeps playback going when the queue runs out.
 *
 * Detects a natural end of queue, then asks the catalogue for follow-on tracks
 * seeded from what just finished and appends them. Headless.
 *
 * This is a real catalogue feature rather than a guess: the suggestions come
 * from the upstream station for that track. If the request fails or returns
 * nothing, playback simply stops, which is the honest outcome.
 */
export function AutoplayExtender() {
  const busyRef = useRef(false);
  const lastSeedRef = useRef<string | null>(null);

  useEffect(() => {
    const unsubscribe = usePlayer.subscribe((state, previous) => {
      // The store stops playback and resets the position when a queue ends with
      // repeat off. That transition is the signal to extend.
      const justEnded =
        previous.isPlaying &&
        !state.isPlaying &&
        state.currentTime === 0 &&
        state.repeat === 'off' &&
        state.order.length > 0 &&
        state.orderPos === state.order.length - 1;

      if (!justEnded || !state.autoplay || busyRef.current) return;

      const seed = state.currentTrack();
      // Do not seed twice from the same track: if its suggestions produced
      // nothing once, retrying in a loop would just hammer the API.
      if (!seed || lastSeedRef.current === seed.id) return;

      lastSeedRef.current = seed.id;
      busyRef.current = true;

      void (async () => {
        try {
          const res = await fetch(`/api/suggestions/${encodeURIComponent(seed.id)}?limit=12`);
          if (!res.ok) return;

          const suggestions = (await res.json()) as Song[];
          const current = usePlayer.getState();

          // Bail out if the listener started something else in the meantime.
          if (current.currentTrack()?.id !== seed.id || current.isPlaying) return;

          const known = new Set(current.queue.map((song) => song.id));
          const fresh = suggestions.filter((song) => song?.id && !known.has(song.id));
          if (!fresh.length) return;

          fresh.forEach((song) => current.addToQueue(song));
          // Advance into the first appended track.
          usePlayer.getState().next(false);
        } catch {
          /* offline or upstream failure: stop quietly, the queue simply ends */
        } finally {
          busyRef.current = false;
        }
      })();
    });

    return unsubscribe;
  }, []);

  return null;
}
