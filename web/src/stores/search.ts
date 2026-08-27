'use client';

import { create } from 'zustand';

/**
 * Recent search queries, on this device.
 *
 * Kept as plain strings rather than as result records. A recent search is a *query* you
 * might want to run again, not a thing you looked at: storing the result would pin it to
 * whatever the catalogue returned that day, and would go stale.
 */
const KEY = 'musicarea:search:v1';

/** Enough to be useful, short enough to stay a list rather than a history. */
const MAX_RECENT = 8;

function load(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
      .slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

function persist(recent: string[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(KEY, JSON.stringify(recent));
  } catch {
    /* quota or unavailable */
  }
}

interface SearchState {
  recent: string[];
  /** False until localStorage has been read. Screens must wait on this before rendering
   *  the list, or the server markup and first client render disagree. */
  hydrated: boolean;

  hydrate: () => void;
  record: (query: string) => void;
  remove: (query: string) => void;
  clear: () => void;
}

export const useSearchHistory = create<SearchState>((set, get) => ({
  recent: [],
  hydrated: false,

  hydrate: () => {
    if (get().hydrated) return;
    set({ recent: load(), hydrated: true });
  },

  record: (query) => {
    const trimmed = query.trim();
    // Very short queries are almost always a partial word committed by accident, and they
    // crowd out the real ones.
    if (trimmed.length < 2) return;
    get().hydrate();
    const lower = trimmed.toLowerCase();
    // Compared case-insensitively so "arijit" and "Arijit" are one entry, but the casing the
    // listener actually typed is what gets stored.
    const next = [trimmed, ...get().recent.filter((entry) => entry.toLowerCase() !== lower)].slice(
      0,
      MAX_RECENT,
    );
    set({ recent: next });
    persist(next);
  },

  remove: (query) => {
    get().hydrate();
    const lower = query.toLowerCase();
    const next = get().recent.filter((entry) => entry.toLowerCase() !== lower);
    set({ recent: next });
    persist(next);
  },

  clear: () => {
    get().hydrate();
    set({ recent: [] });
    persist([]);
  },
}));
