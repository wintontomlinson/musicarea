'use client';

import { useEffect, useRef } from 'react';
import { useLibrary } from '@/stores/library';
import { usePlayer } from '@/stores/player';

/**
 * Connects the library to the rest of the application. Headless.
 *
 * Two jobs: read the stored library once on the client, and record listening
 * history. A play is only recorded after the track has actually been playing for
 * a few seconds, so skipping through a queue does not fill the history with
 * tracks nobody heard.
 */
export function LibraryBridge() {
  const hydrate = useLibrary((s) => s.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const recordedRef = useRef<string | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    function clearTimer() {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    }

    const unsubscribe = usePlayer.subscribe((state, previous) => {
      const track = state.currentTrack();
      const previousId = previous.currentTrack()?.id;

      // A new track cancels any pending record for the previous one.
      if (track?.id !== previousId) {
        clearTimer();
        recordedRef.current = null;
      }

      if (!track || !state.isPlaying || recordedRef.current === track.id) return;
      if (timerRef.current !== null) return;

      const id = track.id;
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        const current = usePlayer.getState();
        // Still the same track, still playing: it counts as listened to.
        if (current.isPlaying && current.currentTrack()?.id === id) {
          recordedRef.current = id;
          useLibrary.getState().recordPlay(track);
        }
      }, 6000);
    });

    return () => {
      unsubscribe();
      clearTimer();
    };
  }, []);

  return null;
}
