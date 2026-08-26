'use client';

import { useEffect, useRef } from 'react';
import { usePlayer } from '@/stores/player';
import { readSpectrum, VISUALIZER_BARS } from '@/lib/audioGraph';

/**
 * Real frequency bars, read from the audio graph.
 *
 * Drawn to a canvas rather than as elements. The alternative is a row of divs
 * whose heights are rewritten every frame, which forces layout on each one; a
 * canvas is a single paint. It also runs on `requestAnimationFrame`, which the
 * browser suspends when the tab is hidden, so an unwatched visualizer costs
 * nothing.
 *
 * Renders nothing at all when there is no spectrum to read, which happens when
 * the audio CDN will not allow a cross-origin read. A fake animation would be
 * easy and would be a lie about what the app can see.
 */
export function Visualizer({ className = '' }: { className?: string }) {
  const enabled = usePlayer((s) => s.visualizer);
  const unavailable = usePlayer((s) => s.visualizerUnavailable);
  const isPlaying = usePlayer((s) => s.isPlaying);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number | null>(null);
  // Held across frames so the bars fall smoothly instead of snapping to zero
  // between buffers.
  const levelsRef = useRef<number[]>(new Array(VISUALIZER_BARS).fill(0));

  const active = enabled && !unavailable;

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let disposed = false;

    // An arrow assigned after the null guards, rather than a hoisted declaration:
    // a `function` statement is hoisted above them, so the narrowing of `canvas`
    // and `ctx` would not reach inside it.
    const draw = () => {
      if (disposed) return;
      const spectrum = readSpectrum();
      const levels = levelsRef.current;

      for (let i = 0; i < VISUALIZER_BARS; i++) {
        const target = spectrum?.[i] ?? 0;
        // Rise quickly, fall slowly: a transient should be visible, but bars that
        // drop instantly read as flicker rather than movement.
        levels[i] = target > levels[i] ? target : levels[i] * 0.86 + target * 0.14;
      }

      // Match the backing store to the displayed size so bars stay crisp on a
      // high-density screen and do not stretch when the sheet resizes.
      const ratio = Math.min(2, window.devicePixelRatio || 1);
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (canvas.width !== width * ratio || canvas.height !== height * ratio) {
        canvas.width = Math.max(1, Math.floor(width * ratio));
        canvas.height = Math.max(1, Math.floor(height * ratio));
      }

      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.clearRect(0, 0, width, height);

      const gap = 2;
      const barWidth = Math.max(1, (width - gap * (VISUALIZER_BARS - 1)) / VISUALIZER_BARS);
      const gradient = ctx.createLinearGradient(0, height, 0, 0);
      gradient.addColorStop(0, 'rgba(255, 59, 191, 0.95)');
      gradient.addColorStop(0.55, 'rgba(168, 85, 247, 0.9)');
      gradient.addColorStop(1, 'rgba(77, 231, 255, 0.85)');
      ctx.fillStyle = gradient;

      for (let i = 0; i < VISUALIZER_BARS; i++) {
        // A floor keeps the row visible while a quiet passage plays, so it reads
        // as an idle meter rather than as broken.
        const level = Math.max(0.02, levels[i]);
        const barHeight = level * height;
        const x = i * (barWidth + gap);
        const y = height - barHeight;
        const radius = Math.min(barWidth / 2, 2);
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, radius);
        ctx.fill();
      }

      frameRef.current = window.requestAnimationFrame(draw);
    };

    frameRef.current = window.requestAnimationFrame(draw);

    return () => {
      disposed = true;
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    };
    // `isPlaying` restarts the loop after a pause, so the bars settle to the floor
    // rather than freezing part-way up.
  }, [active, isPlaying]);

  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`h-10 w-full ${className}`}
    />
  );
}
