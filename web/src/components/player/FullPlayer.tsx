'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { usePlayer } from '@/stores/player';
import { artistLine, pickImage } from '@/lib/utils';
import { Icon } from '@/components/ui/Icon';
import { TransportControls } from './PlayerControls';
import { SeekBar } from './SeekBar';

/**
 * Full-screen now-playing view. Opens over everything with a blurred artwork
 * backdrop. On touch it can be dismissed with a downward swipe: the sheet tracks
 * the finger and closes past a distance or velocity threshold, otherwise snaps
 * back. Also closes on the chevron and on Escape.
 */
export function FullPlayer() {
  const open = usePlayer((s) => s.fullscreen);
  const track = usePlayer((s) => s.currentTrack());
  const setFullscreen = usePlayer((s) => s.setFullscreen);
  const setQueueOpen = usePlayer((s) => s.setQueueOpen);

  const sheetRef = useRef<HTMLDivElement>(null);
  const drag = useRef({ startY: 0, dy: 0, active: false, decided: false, startT: 0 });
  const [settling, setSettling] = useState(false);

  // Lock body scroll while open and close on Escape.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullscreen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, setFullscreen]);

  if (!open || !track) return null;
  const cover = pickImage(track.image);

  function apply(dy: number) {
    const el = sheetRef.current;
    if (!el) return;
    if (dy <= 0) {
      el.style.transform = '';
      el.style.opacity = '';
      return;
    }
    el.style.transform = `translateY(${dy}px)`;
    el.style.opacity = String(Math.max(0.4, 1 - dy / 900));
  }

  function onTouchStart(e: React.TouchEvent) {
    // Only arm from the top of the scrollable area.
    const scroller = sheetRef.current;
    if (scroller && scroller.scrollTop > 0) return;
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    drag.current = { startY: t.clientY, dy: 0, active: true, decided: false, startT: Date.now() };
    setSettling(false);
  }

  function onTouchMove(e: React.TouchEvent) {
    const d = drag.current;
    if (!d.active) return;
    const raw = e.touches[0].clientY - d.startY;
    if (!d.decided) {
      if (raw < 6) return;
      if ((sheetRef.current?.scrollTop ?? 0) > 0) {
        d.active = false;
        return;
      }
      d.decided = true;
    }
    d.dy = Math.max(0, raw);
    apply(d.dy);
  }

  function onTouchEnd() {
    const d = drag.current;
    if (!d.active) return;
    d.active = false;
    if (!d.decided) return;
    const velocity = d.dy / (Date.now() - d.startT || 1);
    setSettling(true);
    if (d.dy > 120 || (velocity > 0.6 && d.dy > 60)) {
      setFullscreen(false);
    } else {
      apply(0);
    }
  }

  return (
    <section
      aria-label="Now playing"
      className="fixed inset-0 z-50 overflow-hidden"
    >
      {/* Blurred artwork backdrop with a dark scrim. */}
      <div className="absolute inset-0">
        <Image src={cover} alt="" fill priority sizes="100vw" className="scale-125 object-cover opacity-40 blur-3xl" />
        <div className="absolute inset-0 bg-black/70" />
      </div>

      <div
        ref={sheetRef}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
        className={`relative flex h-full flex-col overflow-y-auto ${
          settling ? 'transition-[transform,opacity] duration-300 ease-smooth' : ''
        }`}
      >
        {/* Header */}
        <header className="flex items-center justify-between p-4 sm:p-6">
          <button
            type="button"
            aria-label="Minimize player"
            onClick={() => setFullscreen(false)}
            className="grid h-10 w-10 place-items-center rounded-full text-white/80 hover:bg-white/10"
          >
            <Icon name="collapse" size={22} />
          </button>
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-white/60">
            Now Playing
          </span>
          <button
            type="button"
            aria-label="Show queue"
            onClick={() => setQueueOpen(true)}
            className="grid h-10 w-10 place-items-center rounded-full text-white/80 hover:bg-white/10"
          >
            <Icon name="queue" size={20} />
          </button>
        </header>

        {/* Artwork + info + controls */}
        <div className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center gap-6 px-6 pb-10">
          <div className="relative aspect-square w-full max-w-sm overflow-hidden rounded-xl2 shadow-lift">
            <Image src={cover} alt={track.name} fill priority sizes="384px" className="object-cover" />
          </div>

          <div className="w-full text-center">
            <h1 className="truncate text-h3 font-extrabold tracking-tight">{track.name}</h1>
            <p className="mt-1 truncate text-h5 text-text-secondary">{artistLine(track)}</p>
          </div>

          <div className="w-full">
            <SeekBar showTimes />
          </div>

          <TransportControls size="full" />
        </div>
      </div>
    </section>
  );
}
