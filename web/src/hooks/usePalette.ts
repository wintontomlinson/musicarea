'use client';

import { useTheme } from '@/stores/theme';
import type { Palette, Rgb } from '@/lib/color';

/**
 * The palette currently painted on the document, as numbers.
 *
 * Use this only where CSS cannot reach. Styling should go through the Tailwind
 * tokens (`bg-accent`, `text-on-accent`) or `rgb(var(--accent-rgb) / …)` directly,
 * because those cross-fade for free with the 600ms variable transition in
 * `globals.css`. Values read through this hook change in one step instead, since
 * they are React state rather than an interpolated custom property.
 *
 * The legitimate consumers are the ones CSS variables cannot serve: `canvas`
 * (the share card image), SVG gradient stops, and the ambient visualizer.
 */
export function usePalette(): Palette {
  return useTheme((state) => state.palette);
}

/** `rgb()` / `rgba()` string for a palette entry, for canvas and SVG. */
export function css({ r, g, b }: Rgb, alpha = 1): string {
  return alpha >= 1 ? `rgb(${r} ${g} ${b})` : `rgb(${r} ${g} ${b} / ${alpha})`;
}

/** `#rrggbb`, for the few APIs that reject the functional notation. */
export function hex({ r, g, b }: Rgb): string {
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}
