'use client';

import { useEffect } from 'react';
import { usePlayer } from '@/stores/player';
import { artistLine, pickImage } from '@/lib/utils';

/**
 * Bridges playback to the OS via the MediaSession API, so lock-screen and
 * notification controls (and hardware media keys) drive the player. Updates the
 * metadata on track change and keeps the playback state and position in sync.
 */
export function MediaSession() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    const ms = navigator.mediaSession;

    ms.setActionHandler('play', () => usePlayer.getState().setPlaying(true));
    ms.setActionHandler('pause', () => usePlayer.getState().setPlaying(false));
    ms.setActionHandler('previoustrack', () => usePlayer.getState().prev());
    ms.setActionHandler('nexttrack', () => usePlayer.getState().next(false));
    ms.setActionHandler('seekto', (details) => {
      const s = usePlayer.getState();
      if (typeof details.seekTime === 'number') s.setProgress(details.seekTime, s.duration);
    });
    ms.setActionHandler('seekforward', () => {
      const s = usePlayer.getState();
      s.setProgress(Math.min(s.duration, s.currentTime + 10), s.duration);
    });
    ms.setActionHandler('seekbackward', () => {
      const s = usePlayer.getState();
      s.setProgress(Math.max(0, s.currentTime - 10), s.duration);
    });

    let lastId: string | null = null;

    const unsub = usePlayer.subscribe((state) => {
      const track = state.currentTrack();

      // Update metadata only when the track actually changes.
      if (track && track.id !== lastId) {
        lastId = track.id;
        const cover = pickImage(track.image);
        ms.metadata = new MediaMetadata({
          title: track.name,
          artist: artistLine(track),
          album: track.album?.name || '',
          artwork: [
            { src: cover, sizes: '500x500', type: 'image/jpeg' },
          ],
        });
      } else if (!track) {
        lastId = null;
        ms.metadata = null;
      }

      ms.playbackState = state.isPlaying ? 'playing' : 'paused';

      // Keep the scrubber position in sync where supported.
      if (state.duration > 0 && typeof ms.setPositionState === 'function') {
        try {
          ms.setPositionState({
            duration: state.duration,
            position: Math.min(state.currentTime, state.duration),
            playbackRate: 1,
          });
        } catch {
          /* setPositionState throws if position > duration mid-update; ignore */
        }
      }
    });

    return () => {
      unsub();
      for (const action of [
        'play',
        'pause',
        'previoustrack',
        'nexttrack',
        'seekto',
        'seekforward',
        'seekbackward',
      ] as const) {
        try {
          ms.setActionHandler(action, null);
        } catch {
          /* some actions may be unsupported */
        }
      }
    };
  }, []);

  return null;
}
