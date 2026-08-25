'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { usePlayer } from '@/stores/player';
import { artistLine, pickImage } from '@/lib/utils';
import { Icon } from '@/components/ui/Icon';
import { TransportControls } from './PlayerControls';
import { SeekBar } from './SeekBar';

export function FullPlayer() {
  const open = usePlayer((s) => s.fullscreen);
  const track = usePlayer((s) => s.currentTrack());
  const setFullscreen = usePlayer((s) => s.setFullscreen);
  const setQueueOpen = usePlayer((s) => s.setQueueOpen);

  const sheetRef = useRef<HTMLDivElement>(null);
  const drag = useRef({ startY: 0, dy: 0, active: false, decided: false, startT: 0 });
  const [settling, setSettling] = useState(false);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setFullscreen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, setFullscreen]);

  if (!open || !track) return null;
  const cover = pickImage(track.image);

  function apply(dy: number) {
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
    const sheet = sheetRef.current;
    if (sheet && sheet.scrollTop > 0) return;
    if (event.touches.length !== 1) return;
    const touch = event.touches[0];
    drag.current = { startY: touch.clientY, dy: 0, active: true, decided: false, startT: Date.now() };
    setSettling(false);
  }

  function onTouchMove(event: React.TouchEvent) {
    const state = drag.current;
    if (!state.active) return;
    const raw = event.touches[0].clientY - state.startY;
    if (!state.decided) {
      if (raw < 6) return;
      if ((sheetRef.current?.scrollTop ?? 0) > 0) {
        state.active = false;
        return;
      }
      state.decided = true;
    }
    state.dy = Math.max(0, raw);
    apply(state.dy);
  }

  function onTouchEnd() {
    const state = drag.current;
    if (!state.active) return;
    state.active = false;
    if (!state.decided) return;
    const velocity = state.dy / (Date.now() - state.startT || 1);
    setSettling(true);
    if (state.dy > 120 || (velocity > 0.6 && state.dy > 60)) setFullscreen(false);
    else apply(0);
  }

  return (
    <section aria-label="Now playing" className="fixed inset-0 z-50 overflow-hidden bg-bg">
      <div className="absolute inset-0 bg-gradient-to-b from-white/[0.07] to-transparent" />
      <div
        ref={sheetRef}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
        className={`relative mx-auto flex h-full max-w-2xl flex-col overflow-y-auto ${
          settling ? 'transition-[transform,opacity] duration-300 ease-smooth' : ''
        }`}
      >
        <header className="flex items-center justify-between p-4 sm:p-6">
          <button
            type="button"
            aria-label="Minimize player"
            onClick={() => setFullscreen(false)}
            className="grid h-10 w-10 place-items-center rounded-full text-text-secondary transition-colors hover:bg-white/10 hover:text-white"
          >
            <Icon name="collapse" size={22} />
          </button>
          <span className="text-xs font-bold uppercase tracking-[0.16em] text-text-secondary">Now playing</span>
          <button
            type="button"
            aria-label="Show queue"
            onClick={() => setQueueOpen(true)}
            className="grid h-10 w-10 place-items-center rounded-full text-text-secondary transition-colors hover:bg-white/10 hover:text-white"
          >
            <Icon name="queue" size={20} />
          </button>
        </header>

        <div className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center gap-6 px-6 pb-10">
          <div className="relative aspect-square w-full overflow-hidden rounded-xl2 bg-surface shadow-lift">
            <Image src={cover} alt={track.name} fill priority sizes="512px" className="object-cover" />
          </div>
          <div>
            <h1 className="truncate text-h3 font-extrabold tracking-tight">{track.name}</h1>
            <p className="mt-1 truncate text-base text-text-secondary">{artistLine(track)}</p>
          </div>
          <SeekBar showTimes />
          <TransportControls size="full" />
        </div>
      </div>
    </section>
  );
}
