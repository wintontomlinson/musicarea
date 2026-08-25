'use client';

import { useEffect } from 'react';
import { usePlayer } from '@/stores/player';

/**
 * Global keyboard shortcuts for playback. Typing in an input or textarea is
 * never intercepted, and modifier combinations (Ctrl/Cmd/Alt) are ignored so
 * browser shortcuts keep working.
 *
 *   Space / k   play/pause
 *   ArrowRight  seek +5s   (Shift = next track)
 *   ArrowLeft   seek -5s   (Shift = previous track)
 *   ArrowUp     volume +5%
 *   ArrowDown   volume -5%
 *   m           mute
 *   s           shuffle
 *   r           repeat
 */
export function KeyboardShortcuts() {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      const s = usePlayer.getState();
      if (!s.currentTrack() && e.key !== ' ') return;

      const key = e.key.toLowerCase();
      switch (e.key) {
        case ' ':
          e.preventDefault();
          s.toggle();
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (e.shiftKey) s.next(false);
          else s.setProgress(Math.min(s.duration, s.currentTime + 5), s.duration);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (e.shiftKey) s.prev();
          else s.setProgress(Math.max(0, s.currentTime - 5), s.duration);
          break;
        case 'ArrowUp':
          e.preventDefault();
          s.setVolume(Math.min(1, s.volume + 0.05));
          break;
        case 'ArrowDown':
          e.preventDefault();
          s.setVolume(Math.max(0, s.volume - 0.05));
          break;
        default:
          if (key === 'k') {
            e.preventDefault();
            s.toggle();
          } else if (key === 'm') {
            s.toggleMute();
          } else if (key === 's') {
            s.toggleShuffle();
          } else if (key === 'r') {
            s.cycleRepeat();
          }
      }
    }

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return null;
}
