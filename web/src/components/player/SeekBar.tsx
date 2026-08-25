'use client';

import { useRef } from 'react';
import { usePlayer } from '@/stores/player';
import { formatDuration } from '@/lib/utils';

/**
 * Clickable/draggable progress bar. Writes the new time into the store, which
 * the audio engine picks up and seeks to. `showTimes` renders the elapsed and
 * total labels for the full player.
 */
export function SeekBar({ showTimes = false }: { showTimes?: boolean }) {
  const currentTime = usePlayer((s) => s.currentTime);
  const duration = usePlayer((s) => s.duration);
  const setProgress = usePlayer((s) => s.setProgress);
  const trackRef = useRef<HTMLDivElement>(null);

  const pct = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  function seekFromClientX(clientX: number) {
    const el = trackRef.current;
    if (!el || duration <= 0) return;
    const rect = el.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    setProgress(ratio * duration, duration);
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
    if (e.key === 'ArrowRight') {
      setProgress(Math.min(duration, currentTime + 5), duration);
    } else if (e.key === 'ArrowLeft') {
      setProgress(Math.max(0, currentTime - 5), duration);
    }
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
      className="group relative h-1.5 w-full cursor-pointer touch-none rounded-full bg-white/15"
    >
      <div
        className="absolute inset-y-0 left-0 rounded-full bg-white"
        style={{ width: `${pct}%` }}
      />
      <div
        className="absolute top-1/2 h-3 w-3 -translate-y-1/2 -translate-x-1/2 rounded-full bg-white opacity-0 shadow transition-opacity duration-150 group-hover:opacity-100"
        style={{ left: `${pct}%` }}
      />
    </div>
  );

  if (!showTimes) return bar;

  return (
    <div className="flex items-center gap-3">
      <span className="w-10 text-right text-xs tabular-nums text-text-secondary">
        {formatDuration(currentTime)}
      </span>
      {bar}
      <span className="w-10 text-xs tabular-nums text-text-secondary">
        {formatDuration(duration)}
      </span>
    </div>
  );
}
