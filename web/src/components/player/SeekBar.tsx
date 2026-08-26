'use client';

import { useRef, useState } from 'react';
import { usePlayer } from '@/stores/player';
import { formatDuration } from '@/lib/utils';

/**
 * Seek rail.
 *
 * A slim neutral track that fills with the accent, with a knob that appears on
 * hover or while dragging. Dragging updates a local preview value so the handle
 * tracks the pointer smoothly, and the store is written on release, which avoids
 * asking the audio engine to re-buffer on every pointer move.
 *
 * Exposed as a real slider to assistive technology, with arrow key seeking.
 */
export function SeekBar({
  showTimes = false,
  size = 'sm',
}: {
  showTimes?: boolean;
  size?: 'sm' | 'lg';
}) {
  const currentTime = usePlayer((s) => s.currentTime);
  const duration = usePlayer((s) => s.duration);
  const setProgress = usePlayer((s) => s.setProgress);
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragValue, setDragValue] = useState<number | null>(null);

  const value = dragValue ?? currentTime;
  const pct = duration > 0 ? Math.min(100, Math.max(0, (value / duration) * 100)) : 0;

  function valueFromClientX(clientX: number): number {
    const el = trackRef.current;
    if (!el || duration <= 0) return 0;
    const rect = el.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return ratio * duration;
  }

  function onPointerDown(event: React.PointerEvent) {
    if (duration <= 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragValue(valueFromClientX(event.clientX));
  }

  function onPointerMove(event: React.PointerEvent) {
    if (dragValue === null) return;
    setDragValue(valueFromClientX(event.clientX));
  }

  function onPointerUp(event: React.PointerEvent) {
    if (dragValue === null) return;
    const next = valueFromClientX(event.clientX);
    setDragValue(null);
    setProgress(next, duration);
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (duration <= 0) return;
    const step = event.shiftKey ? 15 : 5;
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      setProgress(Math.min(duration, currentTime + step), duration);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      setProgress(Math.max(0, currentTime - step), duration);
    } else if (event.key === 'Home') {
      event.preventDefault();
      setProgress(0, duration);
    }
  }

  const railHeight = size === 'lg' ? 'h-1.5' : 'h-1';
  const knob = size === 'lg' ? 'h-3.5 w-3.5' : 'h-3 w-3';

  const rail = (
    <div
      ref={trackRef}
      role="slider"
      tabIndex={0}
      aria-label="Seek"
      aria-valuemin={0}
      aria-valuemax={Math.max(0, Math.round(duration))}
      aria-valuenow={Math.round(value)}
      aria-valuetext={`${formatDuration(value)} of ${formatDuration(duration)}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onKeyDown={onKeyDown}
      // Vertical padding widens the pointer target without thickening the rail.
      className="group relative flex w-full cursor-pointer touch-none items-center py-2"
    >
      <div className={`relative w-full overflow-hidden rounded-full bg-white/20 ${railHeight}`}>
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-accent"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div
        className={`pointer-events-none absolute -translate-x-1/2 rounded-full bg-text transition-opacity duration-fast ${knob} ${
          dragValue !== null ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        }`}
        style={{ left: `${pct}%` }}
      />
    </div>
  );

  if (!showTimes) return rail;

  return (
    <div className="flex items-center gap-2.5">
      <span className="w-9 shrink-0 text-right text-micro tabular-nums text-text-secondary">
        {formatDuration(value)}
      </span>
      {rail}
      <span className="w-9 shrink-0 text-micro tabular-nums text-text-secondary">
        {formatDuration(duration)}
      </span>
    </div>
  );
}
