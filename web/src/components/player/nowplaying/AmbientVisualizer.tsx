'use client';

import { useEffect, useRef } from 'react';
import { usePlayer } from '@/stores/player';
import { usePalette, css } from '@/hooks/usePalette';

/**
 * An ambient visualiser behind the artwork.
 *
 * **It is not reactive to the audio, and it is named to say so.** A real frequency visualiser needs
 * a Web Audio `AnalyserNode`, which is unavailable here for two independent reasons: the audio
 * engine runs Howler with `html5: true` (deliberately, because it is what makes long tracks and
 * mobile playback reliable), and the CDN serving the audio sends no CORS headers, so the graph
 * would be tainted and the analyser would read silence. Switching either would trade working
 * playback for a decoration.
 *
 * So this is honest ambient motion instead: smooth bands whose heights come from layered sine waves
 * driven by the playback clock, tinted from the extracted palette. It conveys "audio is playing"
 * and it moves in time, but it is not pretending to show the spectrum. Calling it a waveform would
 * have been the lie; calling it ambient is not.
 *
 * Drawn on a canvas rather than as animated DOM: 48 bands as elements, each transitioning height
 * every frame, is enough layout work to drop frames on a mid-range phone. One canvas is one paint.
 */

const BANDS = 48;

export function AmbientVisualizer({ className = '' }: { className?: string }) {
  const isPlaying = usePlayer((state) => state.isPlaying);
  const palette = usePalette();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  /** Per-band smoothed height, so bands ease between frames rather than jumping. */
  const levels = useRef<number[]>(new Array(BANDS).fill(0));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Honour the OS setting directly. The rest of the app gets this through Framer's MotionConfig,
    // but a hand-written canvas loop has to check for itself.
    const reduced =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let frame = 0;
    let width = 0;
    let height = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      // Capped at 2 because beyond that the extra pixels are invisible on a blurred decoration and
      // cost real fill rate on high-density phones.
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, Math.floor(rect.width));
      height = Math.max(1, Math.floor(rect.height));
      canvas.width = width * ratio;
      canvas.height = height * ratio;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    };

    resize();
    const observer =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    observer?.observe(canvas);

    const render = (now: number) => {
      ctx.clearRect(0, 0, width, height);
      const time = now / 1000;
      const barWidth = width / BANDS;

      for (let i = 0; i < BANDS; i++) {
        // Three incommensurate frequencies per band, so the pattern never visibly repeats. The
        // per-band phase offset is what stops all the bands moving together like a single wave.
        const phase = i * 0.38;
        const target = isPlaying
          ? 0.25 +
            0.3 * Math.sin(time * 1.7 + phase) +
            0.22 * Math.sin(time * 2.9 + phase * 1.7) +
            0.14 * Math.sin(time * 4.3 + phase * 0.6)
          : // Paused settles to a low, still baseline rather than to nothing, so the element does
            // not appear to vanish.
            0.06;

        const clamped = Math.max(0.04, Math.min(1, target));
        // Exponential smoothing. Without it the sine sum is already smooth, but the transition
        // between playing and paused would snap.
        levels.current[i] += (clamped - levels.current[i]) * 0.08;

        // Taller in the middle, so the shape reads as a soft mound rather than a flat wall.
        const centreBias = 1 - Math.abs(i / (BANDS - 1) - 0.5) * 1.1;
        const barHeight = levels.current[i] * height * Math.max(0.25, centreBias);

        const gradient = ctx.createLinearGradient(0, height - barHeight, 0, height);
        gradient.addColorStop(0, css(palette.accentAlt, 0.42));
        gradient.addColorStop(1, css(palette.accent, 0.08));
        ctx.fillStyle = gradient;

        const x = i * barWidth;
        const radius = Math.min(barWidth * 0.35, 6);
        ctx.beginPath();
        ctx.moveTo(x + 1, height);
        ctx.lineTo(x + 1, height - barHeight + radius);
        ctx.quadraticCurveTo(x + 1, height - barHeight, x + 1 + radius, height - barHeight);
        ctx.lineTo(x + barWidth - 1 - radius, height - barHeight);
        ctx.quadraticCurveTo(
          x + barWidth - 1,
          height - barHeight,
          x + barWidth - 1,
          height - barHeight + radius,
        );
        ctx.lineTo(x + barWidth - 1, height);
        ctx.closePath();
        ctx.fill();
      }

      // A single static frame under reduced motion: the shape is still there, it just does not move.
      if (!reduced) frame = requestAnimationFrame(render);
    };

    frame = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
    };
    // The palette is a dependency because the gradient colours are baked per frame; changing artwork
    // restarts the loop with the new colours.
  }, [isPlaying, palette]);

  return (
    <canvas
      ref={canvasRef}
      // Decorative. A screen reader gains nothing from a canvas of moving bars.
      aria-hidden="true"
      className={`pointer-events-none w-full ${className}`}
    />
  );
}
