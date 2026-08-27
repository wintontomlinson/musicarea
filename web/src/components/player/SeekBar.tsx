'use client';

import { useRef, useState } from 'react';
import { usePlayer } from '@/stores/player';
import { formatDuration } from '@/lib/utils';

interface SeekBarProps {
  /** Renders elapsed and remaining labels either side of the rail. */
  showTimes?: boolean;
  /** `bar` is the slim rail for the player bar, `full` the taller one for the
   *  immersive player, where it is a primary control rather than an indicator. */
  size?: 'bar' | 'full';
  className?: string;
}

/**
 * Scrub rail.
 *
 * The interaction model is deliberately not an `<input type="range">`. A range
 * input cannot be styled into a rail whose fill, knob and hover preview all follow
 * the artwork palette, and its keyboard step behaviour is per-pixel rather than
 * per-second. What it does provide is semantics, so those are reproduced explicitly:
 * `role="slider"` with the aria value properties, and arrow-key seeking.
 *
 * Two behaviours carried over from the original and worth keeping:
 *
 * Pointer capture is claimed on `pointerdown`, so a drag that leaves the rail (very
 * common on a thin target) keeps seeking instead of stopping the moment the cursor
 * exits the element.
 *
 * The arrow keys call `stopPropagation`. The global shortcut handler also seeks on
 * arrows, and without this both fire and one press moves ten seconds rather than
 * five.
 */
export function SeekBar({ showTimes = false, size = 'bar', className = '' }: SeekBarProps) {
  const currentTime = usePlayer((s) => s.currentTime);
  const duration = usePlayer((s) => s.duration);
  const seekTo = usePlayer((s) => s.seekTo);
  const trackRef = useRef<HTMLDivElement>(null);
  /** Ratio under the cursor while hovering, for the time preview. */
  const [hoverRatio, setHoverRatio] = useState<number | null>(null);

  const pct = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
  const full = size === 'full';

  function ratioFromClientX(clientX: number): number | null {
    const el = trackRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0) return null;
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  }

  function seekFromClientX(clientX: number) {
    if (duration <= 0) return;
    const ratio = ratioFromClientX(clientX);
    if (ratio === null) return;
    seekTo(ratio * duration);
  }

  function onPointerDown(e: React.PointerEvent) {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    seekFromClientX(e.clientX);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (e.buttons === 1) seekFromClientX(e.clientX);
    // Only meaningful for a mouse. Tracking it for touch would leave a preview
    // bubble stranded on screen after the finger lifts.
    if (e.pointerType === 'mouse') setHoverRatio(ratioFromClientX(e.clientX));
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (duration <= 0) return;
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
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
      aria-valuetext={`${formatDuration(currentTime)} of ${formatDuration(duration)}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerLeave={() => setHoverRatio(null)}
      onKeyDown={onKeyDown}
      // The rail is visually thin but the hit area is padded out vertically, because
      // a 4px target is not reliably hittable with a thumb. `touch-none` stops the
      // browser claiming a vertical drag on it as a page scroll.
      className={`group relative w-full shrink-0 cursor-pointer touch-none ${full ? 'py-2.5' : 'py-2'}`}
    >
      <div className={`relative w-full rounded-full bg-white/[0.18] ${full ? 'h-1.5' : 'h-1'}`}>
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-accent"
          style={{ width: `${pct}%` }}
        />
        {/* Hover ghost: a faint fill up to the cursor, showing where a click lands. */}
        {hoverRatio !== null && duration > 0 && (
          <div
            aria-hidden="true"
            className="absolute inset-y-0 left-0 rounded-full bg-white/20"
            style={{ width: `${hoverRatio * 100}%` }}
          />
        )}
        <div
          aria-hidden="true"
          className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white opacity-0 shadow transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 ${
            full ? 'h-3.5 w-3.5' : 'h-3 w-3'
          }`}
          style={{ left: `${pct}%` }}
        />
        {hoverRatio !== null && duration > 0 && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -top-7 -translate-x-1/2 rounded-md bg-scrim/95 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-white shadow-lift"
            style={{ left: `${hoverRatio * 100}%` }}
          >
            {formatDuration(hoverRatio * duration)}
          </span>
        )}
      </div>
    </div>
  );

  if (!showTimes) return <div className={className}>{bar}</div>;

  const remaining = duration > 0 ? Math.max(0, duration - currentTime) : 0;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* `tabular-nums` stops the row twitching as the digits change width, and the
          fixed widths stop the rail resizing when the elapsed time crosses 10:00. */}
      <span className={`shrink-0 text-right tabular-nums text-text-secondary ${full ? 'w-10 text-[12px]' : 'w-8 text-[11px]'}`}>
        {formatDuration(currentTime)}
      </span>
      {bar}
      <span className={`shrink-0 tabular-nums text-text-secondary ${full ? 'w-10 text-[12px]' : 'w-9 text-[11px]'}`}>
        {duration > 0 ? `-${formatDuration(remaining)}` : formatDuration(0)}
      </span>
    </div>
  );
}
