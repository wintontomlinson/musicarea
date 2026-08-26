'use client';

import { create } from 'zustand';

/**
 * Which artwork the site should currently be coloured by.
 *
 * Two things compete for that, and the priority between them is the whole point
 * of this store. A detail page wins over the player: while you are looking at an
 * album, the site takes that album's colour even if something else is playing,
 * which is what makes the page feel like it belongs to the record. Everywhere
 * else there is no page artwork, so the playing track takes over.
 */
const PREFS_KEY = 'musicarea:theme:v1';

interface PersistedTheme {
  adaptive: boolean;
}

const DEFAULT_PREFS: PersistedTheme = { adaptive: true };

function loadPrefs(): PersistedTheme {
  if (typeof window === 'undefined') return DEFAULT_PREFS;
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    return raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
}

function savePrefs(prefs: PersistedTheme) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* quota or unavailable */
  }
}

export interface ThemeState {
  /** Artwork the current route asked to be tinted by, if it has any. */
  pageCover: string | null;
  /** Identifies the mount that registered `pageCover`. See `clearPageCover`. */
  pageToken: number | null;
  /** Artwork of the track that is playing, if any. */
  trackCover: string | null;
  /** When off, the static brand palette is used and no sampling happens. */
  adaptive: boolean;
  /** False until the preference has been read from localStorage. */
  hydrated: boolean;

  /** The cover the palette should be derived from, page artwork first. */
  activeCover: () => string | null;

  hydrate: () => void;
  /** Register page artwork. Placeholder (`data:`) covers are ignored. */
  setPageCover: (cover: string, token: number) => void;
  /** Release page artwork, but only if `token` is still the one holding it. */
  clearPageCover: (token: number) => void;
  setTrackCover: (cover: string | null) => void;
  setAdaptive: (on: boolean) => void;
}

export const useTheme = create<ThemeState>((set, get) => ({
  pageCover: null,
  pageToken: null,
  trackCover: null,
  // Deliberately not read from localStorage at module scope. Settings renders
  // this preference, and reading storage before the first render would make the
  // client disagree with the server-rendered markup. `hydrate` runs in an effect
  // instead, which is a re-render rather than a hydration mismatch.
  adaptive: DEFAULT_PREFS.adaptive,
  hydrated: false,

  activeCover: () => {
    const { pageCover, trackCover } = get();
    return pageCover ?? trackCover;
  },

  hydrate: () => {
    if (get().hydrated) return;
    set({ ...loadPrefs(), hydrated: true });
  },

  setPageCover: (cover, token) => {
    // `pickImage` answers with an inline SVG placeholder rather than null when a
    // record has no artwork, and every detail page passes its result straight
    // through. Treating that placeholder as page artwork would let an
    // artwork-less album outrank the track that is actually playing and snap the
    // site back to the brand palette, so it is rejected here rather than in five
    // separate pages that would each have to remember.
    if (!cover || cover.startsWith('data:')) return;
    set({ pageCover: cover, pageToken: token });
  },

  clearPageCover: (token) => {
    // Keyed on the mount, not on the URL. If the outgoing page's cleanup runs
    // after the incoming page has registered, the tokens differ and the clear is
    // skipped, which a URL comparison would get wrong for two consecutive pages
    // that happen to share a cover (a song reached from its own album).
    if (get().pageToken === token) set({ pageCover: null, pageToken: null });
  },

  setTrackCover: (cover) => {
    if (get().trackCover !== cover) set({ trackCover: cover });
  },

  setAdaptive: (on) => {
    set({ adaptive: on });
    savePrefs({ adaptive: on });
  },
}));
