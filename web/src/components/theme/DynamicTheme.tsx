'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { usePlayer } from '@/stores/player';
import { useTheme } from '@/stores/theme';
import { pickImage } from '@/lib/utils';
import { applyPalette, defaultPalette, extractPalette, paletteForMode } from '@/lib/color';

/**
 * Holding down "next" walks the queue a track at a time, and sampling every one
 * of them would fire an optimizer request per track for artwork nobody sees. The
 * palette only follows once the listener settles.
 */
const SETTLE_MS = 220;

/**
 * Headless. Watches whatever artwork is in front of the listener and repaints the
 * design tokens from it, so the site takes on the colour of the album.
 *
 * Mounted alongside the audio engine rather than wrapped around the tree: there
 * is nothing to render and nothing to provide, and keeping it out of the render
 * path means the server components above it stay server components.
 */
export function DynamicTheme() {
  const hydrate = useTheme((state) => state.hydrate);
  const accentMode = useTheme((state) => state.accentMode);
  const neutralMode = useTheme((state) => state.neutralMode);
  const pageCover = useTheme((state) => state.pageCover);
  const trackCover = useTheme((state) => state.trackCover);
  const setTrackCover = useTheme((state) => state.setTrackCover);
  const setPalette = useTheme((state) => state.setPalette);
  // The images array, not the track object: its identity only changes when the
  // track does, so queue edits and progress ticks do not re-run the sampling.
  const trackImages = usePlayer((state) => state.currentTrack()?.image);
  const pathname = usePathname();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    setTrackCover(trackImages ? pickImage(trackImages) : null);
  }, [trackImages, setTrackCover]);

  const cover = pageCover ?? trackCover;

  useEffect(() => {
    // Paint the document and publish the same palette to the store, so canvas and
    // SVG consumers read exactly what is on screen rather than a second guess at
    // it. Kept in one helper because these two must never disagree.
    const paint = (palette: ReturnType<typeof defaultPalette>) => {
      applyPalette(palette);
      setPalette(palette);
    };

    // A pinned accent needs no artwork and no sampling, so it resolves
    // synchronously and skips the settle delay entirely.
    const pinned = paletteForMode(accentMode, neutralMode);
    if (pinned) {
      paint(pinned);
      return;
    }

    if (!cover) {
      paint(defaultPalette(neutralMode));
      return;
    }

    let active = true;
    const settle = window.setTimeout(() => {
      extractPalette(cover, { neutralMode }).then((palette) => {
        // A fast skip between tracks can resolve out of order. Only the newest
        // request is allowed to paint.
        if (active) paint(palette);
      });
    }, SETTLE_MS);
    return () => {
      active = false;
      window.clearTimeout(settle);
    };
    // `pathname` is in here on purpose. The App Router owns the `theme-color`
    // meta tag through the root `viewport` export and re-asserts it across
    // navigations; without this the browser chrome would drift back to the
    // default while the page itself stayed tinted.
  }, [accentMode, neutralMode, cover, pathname, setPalette]);

  return null;
}
