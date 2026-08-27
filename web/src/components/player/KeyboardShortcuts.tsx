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
 *   f           full-screen player
 *   q           queue panel
 *   l           lyrics (opens the full-screen player on the lyrics pane)
 *
 * Escape is deliberately absent. The open surfaces handle it themselves through
 * `Sheet`, which tracks a stack of them so one press closes exactly one layer; a
 * global handler here would close all of them at once.
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
          } else if (key === 'f') {
            e.preventDefault();
            s.setFullscreen(!s.fullscreen);
          } else if (key === 'q') {
            e.preventDefault();
            s.setQueueOpen(!s.queueOpen);
          } else if (key === 'l') {
            e.preventDefault();
            // Opens the player onto the lyrics rather than just flipping a pane,
            // because lyrics are only rendered inside the full-screen player. Pressing
            // it again closes the player, so the key round-trips.
            if (s.fullscreen && s.lyricsOpen) {
              s.setFullscreen(false);
            } else {
              s.setLyricsOpen(true);
              s.setFullscreen(true);
            }
          }
      }
    }

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return null;
}
