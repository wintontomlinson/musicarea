'use client';

import { useEffect, useRef } from 'react';
import { usePlayer } from '@/stores/player';
import type { RadioSet } from '@/lib/types';

/**
 * Keeps playback going past the end of the queue.
 *
 * When the listener is on the last track, a station is built from it and appended,
 * so an album or a search result set does not simply stop. The station is
 * taste-ranked by the same recommender that builds the feed, which is why this
 * uses `/api/radio/<id>` rather than the catalogue's own suggestions endpoint:
 * that one is an unranked passthrough with no diversity pass and no awareness of
 * what the listener has already heard.
 *
 * Effect-only, mounted once in the main layout.
 */

/** Extend while this many tracks or fewer remain after the current one. */
const REMAINING_THRESHOLD = 1;

/**
 * Stop growing the queue past this. Autoplay is open-ended by nature, and an
 * unbounded queue would keep accumulating for as long as a tab is left playing.
 */
const MAX_QUEUE = 200;

export function AutoplayRadio() {
  // The seed already used, so a station is fetched once per track rather than on
  // every progress tick.
  const seedRef = useRef<string | null>(null);
  const busyRef = useRef(false);

  useEffect(() => {
    let alive = true;

    async function extendFrom(songId: string) {
      busyRef.current = true;
      try {
        const res = await fetch(`/api/radio/${encodeURIComponent(songId)}?limit=20`);
        if (!res.ok || !alive) return;
        const data = (await res.json()) as RadioSet;
        if (!alive || !Array.isArray(data.items) || !data.items.length) return;
        // Re-check before committing: the listener may have started something
        // else entirely while the station was being built.
        const state = usePlayer.getState();
        if (state.currentTrack()?.id !== songId) return;
        state.extendQueue(data.items);
      } catch {
        /* offline or rate limited: leave the queue as it is and try the next track */
      } finally {
        busyRef.current = false;
      }
    }

    const unsub = usePlayer.subscribe((state) => {
      if (!state.autoplay || busyRef.current) return;
      // Repeat already keeps playback going, so a station would only pad the
      // queue with tracks nobody asked for.
      if (state.repeat !== 'off') return;
      if (!state.order.length || state.queue.length >= MAX_QUEUE) return;

      const remaining = state.order.length - 1 - state.orderPos;
      if (remaining > REMAINING_THRESHOLD) return;

      const track = state.currentTrack();
      if (!track?.id || seedRef.current === track.id) return;

      seedRef.current = track.id;
      void extendFrom(track.id);
    });

    return () => {
      alive = false;
      unsub();
    };
  }, []);

  return null;
}
