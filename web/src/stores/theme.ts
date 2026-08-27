'use client';

import { create } from 'zustand';
import {
  DEFAULT_PALETTE,
  type AccentMode,
  type NeutralMode,
  type Palette,
} from '@/lib/color';

/**
 * Which artwork the site should currently be coloured by, and how that colour is
 * allowed to be used.
 *
 * Two things compete for the artwork slot, and the priority between them is the
 * original point of this store. A detail page wins over the player: while you are
 * looking at an album, the site takes that album's colour even if something else
 * is playing, which is what makes the page feel like it belongs to the record.
 * Everywhere else there is no page artwork, so the playing track takes over.
 */
const PREFS_KEY = 'musicarea:theme:v1';

interface PersistedTheme {
  accentMode: AccentMode;
  neutralMode: NeutralMode;
}

const DEFAULT_PREFS: PersistedTheme = { accentMode: 'adaptive', neutralMode: 'tinted' };

const ACCENT_MODES: AccentMode[] = ['adaptive', 'brand', 'green', 'red'];
const NEUTRAL_MODES: NeutralMode[] = ['tinted', 'neutral'];

/**
 * Reads the stored preference, tolerating the previous shape.
 *
 * v1 of this record held a single `adaptive: boolean`. That has been replaced by
 * a four-way accent mode, and `adaptive: false` meant exactly what `brand` means
 * now, so the old value is translated rather than discarded. Anyone who had
 * turned adaptive colour off keeps it off.
 */
function loadPrefs(): PersistedTheme {
  if (typeof window === 'undefined') return DEFAULT_PREFS;
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return DEFAULT_PREFS;
    const record = parsed as Partial<PersistedTheme> & { adaptive?: unknown };

    const legacy: AccentMode | null =
      typeof record.adaptive === 'boolean' ? (record.adaptive ? 'adaptive' : 'brand') : null;

    return {
      accentMode:
        record.accentMode && ACCENT_MODES.includes(record.accentMode)
          ? record.accentMode
          : (legacy ?? DEFAULT_PREFS.accentMode),
      neutralMode:
        record.neutralMode && NEUTRAL_MODES.includes(record.neutralMode)
          ? record.neutralMode
          : DEFAULT_PREFS.neutralMode,
    };
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
  /** Where the accent comes from. `adaptive` samples the artwork. */
  accentMode: AccentMode;
  /** Whether backgrounds follow the accent hue or stay true greyscale. */
  neutralMode: NeutralMode;
  /**
   * The palette currently painted onto the document.
   *
   * The CSS custom properties remain the source of truth for styling, and nothing
   * should read this to set a colour that CSS could set instead. It exists for the
   * consumers CSS cannot reach: canvas (the share card), SVG gradient stops, and
   * the ambient visualizer, all of which need the accent as a number rather than
   * as a variable reference.
   */
  palette: Palette;
  /** False until the preference has been read from localStorage. */
  hydrated: boolean;

  /** The cover the palette should be derived from, page artwork first. */
  activeCover: () => string | null;
  /** True when the accent is sampled from artwork rather than pinned. */
  isAdaptive: () => boolean;

  hydrate: () => void;
  /** Register page artwork. Placeholder (`data:`) covers are ignored. */
  setPageCover: (cover: string, token: number) => void;
  /** Release page artwork, but only if `token` is still the one holding it. */
  clearPageCover: (token: number) => void;
  setTrackCover: (cover: string | null) => void;
  setAccentMode: (mode: AccentMode) => void;
  setNeutralMode: (mode: NeutralMode) => void;
  /** Called by `DynamicTheme` after it paints, to publish the palette to JS. */
  setPalette: (palette: Palette) => void;
}

export const useTheme = create<ThemeState>((set, get) => ({
  pageCover: null,
  pageToken: null,
  trackCover: null,
  // Deliberately not read from localStorage at module scope. Settings renders
  // these preferences, and reading storage before the first render would make the
  // client disagree with the server-rendered markup. `hydrate` runs in an effect
  // instead, which is a re-render rather than a hydration mismatch.
  accentMode: DEFAULT_PREFS.accentMode,
  neutralMode: DEFAULT_PREFS.neutralMode,
  palette: DEFAULT_PALETTE,
  hydrated: false,

  activeCover: () => {
    const { pageCover, trackCover } = get();
    return pageCover ?? trackCover;
  },

  isAdaptive: () => get().accentMode === 'adaptive',

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

  setAccentMode: (mode) => {
    set({ accentMode: mode });
    savePrefs({ accentMode: mode, neutralMode: get().neutralMode });
  },

  setNeutralMode: (mode) => {
    set({ neutralMode: mode });
    savePrefs({ accentMode: get().accentMode, neutralMode: mode });
  },

  setPalette: (palette) => set({ palette }),
}));
