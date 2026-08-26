'use client';

import { useEffect, useRef, useState } from 'react';
import { usePlayer } from '@/stores/player';
import { pickImage } from '@/lib/utils';
import { NowPlayingBackdrop, NowPlayingView } from './NowPlayingView';

/**
 * Full-screen Now Playing overlay.
 *
 * Opened from the mini player, the player bar or the artwork. Closes on the
 * chevron, on Escape and on a downward swipe. The swipe is only claimed once the
 * gesture is clearly vertical and the sheet is scrolled to the top, so it never
 * fights with scrolling the content.
 */
export function NowPlaying() {
  const open = usePlayer((s) => s.fullscreen);
  const track = usePlayer((s) => s.currentTrack());
  const setFullscreen = usePlayer((s) => s.setFullscreen);

  const sheetRef = useRef<HTMLDivElement>(null);
  const drag = useRef({ startY: 0, dy: 0, active: false, decided: false, startedAt: 0 });
  const [settling, setSettling] = useState(false);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setFullscreen(false);
    }
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, setFullscreen]);

  if (!open || !track) return null;

  const cover = pickImage(track.image);

  function applyOffset(dy: number) {
    const sheet = sheetRef.current;
    if (!sheet) return;
    if (dy <= 0) {
      sheet.style.transform = '';
      sheet.style.opacity = '';
      return;
    }
    sheet.style.transform = `translateY(${dy}px)`;
    sheet.style.opacity = String(Math.max(0.4, 1 - dy / 900));
  }

  function onTouchStart(event: React.TouchEvent) {
    if ((sheetRef.current?.scrollTop ?? 0) > 0) return;
    if (event.touches.length !== 1) return;
    drag.current = {
      startY: event.touches[0].clientY,
      dy: 0,
      active: true,
      decided: false,
      startedAt: Date.now(),
    };
    setSettling(false);
  }

  function onTouchMove(event: React.TouchEvent) {
    const state = drag.current;
    if (!state.active) return;
    const delta = event.touches[0].clientY - state.startY;

    if (!state.decided) {
      if (delta < 6) return;
      if ((sheetRef.current?.scrollTop ?? 0) > 0) {
        state.active = false;
        return;
      }
      state.decided = true;
    }

    state.dy = Math.max(0, delta);
    applyOffset(state.dy);
  }

  function onTouchEnd() {
    const state = drag.current;
    if (!state.active) return;
    state.active = false;
    if (!state.decided) return;

    const velocity = state.dy / (Date.now() - state.startedAt || 1);
    setSettling(true);
    if (state.dy > 120 || (velocity > 0.6 && state.dy > 60)) setFullscreen(false);
    else applyOffset(0);
  }

  return (
    <section
      aria-label="Now playing"
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 overflow-hidden bg-bg"
    >
      <NowPlayingBackdrop cover={cover} />

      <div
        ref={sheetRef}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
        className={`relative h-full overflow-y-auto ${
          settling ? 'transition-[transform,opacity] duration-300 ease-out' : ''
        }`}
      >
        <NowPlayingView onClose={() => setFullscreen(false)} />
      </div>
    </section>
  );
}
