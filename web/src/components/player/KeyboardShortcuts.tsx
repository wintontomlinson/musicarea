'use client';

import { useEffect } from 'react';
import { usePlayer } from '@/stores/player';
import { useLibrary } from '@/stores/library';
import { notify } from '@/stores/toast';

/**
 * Global playback shortcuts.
 *
 * Typing is never intercepted: inputs, textareas and contenteditable regions are
 * skipped, as are modifier combinations, so browser and operating system
 * shortcuts keep working.
 *
 *   Space / K    play or pause
 *   N            next track
 *   P            previous track
 *   F            like or unlike the current track
 *   M            mute
 *   S            shuffle
 *   R            cycle repeat
 *   Right / Left seek five seconds, or Shift for the next and previous track
 *   Up / Down    volume
 */
export function KeyboardShortcuts() {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.ctrlKey || event.metaKey || event.altKey) return;

      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      const player = usePlayer.getState();
      const track = player.currentTrack();

      // With nothing loaded, only the play toggle is meaningful.
      if (!track && event.key !== ' ' && event.key.toLowerCase() !== 'k') return;

      switch (event.key) {
        case ' ':
          event.preventDefault();
          player.toggle();
          return;
        case 'ArrowRight':
          event.preventDefault();
          if (event.shiftKey) player.next(false);
          else player.setProgress(Math.min(player.duration, player.currentTime + 5), player.duration);
          return;
        case 'ArrowLeft':
          event.preventDefault();
          if (event.shiftKey) player.prev();
          else player.setProgress(Math.max(0, player.currentTime - 5), player.duration);
          return;
        case 'ArrowUp':
          event.preventDefault();
          player.setVolume(Math.min(1, player.volume + 0.05));
          return;
        case 'ArrowDown':
          event.preventDefault();
          player.setVolume(Math.max(0, player.volume - 0.05));
          return;
        default:
          break;
      }

      switch (event.key.toLowerCase()) {
        case 'k':
          event.preventDefault();
          player.toggle();
          break;
        case 'n':
          player.next(false);
          break;
        case 'p':
          player.prev();
          break;
        case 'f': {
          if (!track) break;
          const added = useLibrary.getState().toggleFavoriteSong(track);
          notify(added ? 'Added to Liked Songs' : 'Removed from Liked Songs');
          break;
        }
        case 'm':
          player.toggleMute();
          break;
        case 's':
          player.toggleShuffle();
          break;
        case 'r':
          player.cycleRepeat();
          break;
        default:
          break;
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return null;
}
