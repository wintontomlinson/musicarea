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
      // With nothing queued there is nothing to control, so leave every key to
      // the browser. Space in particular must keep scrolling the page: it used
      // to be let through and flipped the store into a "playing" state with an
      // empty queue, which left a pause glyph on screen with no audio.
      if (!s.currentTrack()) return;

      const key = e.key.toLowerCase();
      switch (e.key) {
        case ' ':
          e.preventDefault();
          s.toggle();
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (e.shiftKey) s.next(false);
          else s.seekTo(s.currentTime + 5);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (e.shiftKey) s.prev();
          else s.seekTo(s.currentTime - 5);
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
          // Matched case-insensitively so Shift and Caps Lock do not break the
          // letter shortcuts, and each one claims the key so it cannot also
          // trigger a browser default or a focused control.
          if (key === 'k') {
            e.preventDefault();
            s.toggle();
          } else if (key === 'm') {
            e.preventDefault();
            s.toggleMute();
          } else if (key === 's') {
            e.preventDefault();
            s.toggleShuffle();
          } else if (key === 'r') {
            e.preventDefault();
            s.cycleRepeat();
          }
      }
    }

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return null;
}
