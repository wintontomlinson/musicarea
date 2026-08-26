'use client';

import { useRef } from 'react';
import { usePlayer } from '@/stores/player';
import { formatDuration } from '@/lib/utils';

/**
 * Apple Music's slim seek rail: a thin grey track with a white fill and a small
 * knob that appears on hover. Writes the new time into the store, which the
 * audio engine picks up and seeks to. `showTimes` renders elapsed and remaining
 * labels either side, as Apple does.
 */
export function SeekBar({ showTimes = false }: { showTimes?: boolean }) {
  const currentTime = usePlayer((s) => s.currentTime);
  const duration = usePlayer((s) => s.duration);
  const seekTo = usePlayer((s) => s.seekTo);
  const trackRef = useRef<HTMLDivElement>(null);

  const pct = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  function seekFromClientX(clientX: number) {
    const el = trackRef.current;
    if (!el || duration <= 0) return;
    const rect = el.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    seekTo(ratio * duration);
  }

  function onPointerDown(e: React.PointerEvent) {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    seekFromClientX(e.clientX);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (e.buttons === 1) seekFromClientX(e.clientX);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (duration <= 0) return;
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    // The global shortcut handler also seeks on the arrow keys. Without stopping
    // propagation here both fire and one press moves 10 seconds instead of 5.
    e.preventDefault();
    e.stopPropagation();
    seekTo(e.key === 'ArrowRight' ? currentTime + 5 : currentTime - 5);
  }

  const bar = (
    <div
      ref={trackRef}
      role="slider"
      tabIndex={0}
      aria-label="Seek"
      aria-valuemin={0}
      aria-valuemax={Math.round(duration)}
      aria-valuenow={Math.round(currentTime)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onKeyDown={onKeyDown}
      className="group relative h-1 w-full cursor-pointer touch-none rounded-full bg-white/20"
    >
      <div className="absolute inset-y-0 left-0 rounded-full bg-white/70" style={{ width: `${pct}%` }} />
      <div
        className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white opacity-0 shadow transition-opacity group-hover:opacity-100"
        style={{ left: `${pct}%` }}
      />
    </div>
  );

  if (!showTimes) return bar;

  const remaining = duration > 0 ? Math.max(0, duration - currentTime) : 0;

  return (
    <div className="flex items-center gap-2">
      <span className="w-8 text-right text-[11px] tabular-nums text-text-secondary">
        {formatDuration(currentTime)}
      </span>
      {bar}
      <span className="w-9 text-[11px] tabular-nums text-text-secondary">
        {duration > 0 ? `-${formatDuration(remaining)}` : formatDuration(0)}
      </span>
    </div>
  );
}
