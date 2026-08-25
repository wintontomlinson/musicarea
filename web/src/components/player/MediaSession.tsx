'use client';

import { useEffect } from 'react';
import { usePlayer } from '@/stores/player';
import type { Song } from '@/lib/types';
import { artistLine, pickImage } from '@/lib/utils';

/**
 * Bridges playback to the OS via the MediaSession API, so lock-screen and
 * notification controls (and hardware media keys) drive the player. Updates the
 * metadata on track change and keeps the playback state and position in sync,
 * which is what makes the controls usable while the app is in the background.
 */
export function MediaSession() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    const ms = navigator.mediaSession;

    ms.setActionHandler('play', () => usePlayer.getState().setPlaying(true));
    ms.setActionHandler('pause', () => usePlayer.getState().setPlaying(false));
    // The OS "stop" affordance (notification dismiss on Android) halts playback;
    // there is nothing to tear down beyond that for a streaming web player.
    ms.setActionHandler('stop', () => usePlayer.getState().setPlaying(false));
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
        ms.metadata = new MediaMetadata({
          title: track.name,
          artist: artistLine(track),
          album: track.album?.name || '',
          artwork: artworkFor(track),
        });
      } else if (!track) {
        lastId = null;
        ms.metadata = null;
      }

      ms.playbackState = !track ? 'none' : state.isPlaying ? 'playing' : 'paused';

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
        'stop',
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

/**
 * Offer the artwork at every size the catalogue publishes, so the OS can pick
 * one that suits the surface it is drawing (a small notification thumbnail
 * versus a full lock screen) instead of always fetching the largest.
 *
 * `pickImage` deliberately upgrades every URL to 500x500, so the raw entries are
 * used here to keep the declared sizes truthful.
 */
function artworkFor(track: Song): MediaImage[] {
  const sized = (track.image ?? [])
    .filter((image) => image.url && /^\d+x\d+$/.test(image.quality))
    .map((image) => ({ src: image.url, sizes: image.quality, type: 'image/jpeg' }));
  if (sized.length) return sized;
  return [{ src: pickImage(track.image), sizes: '500x500', type: 'image/jpeg' }];
}
