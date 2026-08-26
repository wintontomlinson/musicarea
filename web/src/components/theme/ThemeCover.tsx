'use client';

import { useEffect } from 'react';
import { useTheme } from '@/stores/theme';

/** Monotonic, so every registration is distinguishable from every other. */
let nextToken = 0;

/**
 * Declares the artwork a page wants the site coloured by, and gives it back on
 * navigation away.
 *
 * Detail pages are server components, so they cannot talk to the theme store
 * themselves. Dropping this in is the whole integration: it renders nothing and
 * only exists to register the cover.
 *
 * A placeholder cover (the inline SVG `pickImage` falls back to) is ignored by
 * the store, so pages can pass their cover straight through.
 */
export function ThemeCover({ cover }: { cover: string }) {
  const setPageCover = useTheme((state) => state.setPageCover);
  const clearPageCover = useTheme((state) => state.clearPageCover);

  useEffect(() => {
    // A fresh token per registration. Releasing by token rather than by URL is
    // what keeps a late cleanup from revoking the next page's artwork.
    const token = ++nextToken;
    setPageCover(cover, token);
    return () => clearPageCover(token);
  }, [cover, setPageCover, clearPageCover]);

  return null;
}
