'use client';

import { create } from 'zustand';
import type { Lyrics } from '@/lib/lyrics';

/**
 * In-memory lyrics cache.
 *
 * Deliberately *not* persisted to localStorage. Lyrics are large compared with everything
 * else this app stores, the library already competes for the same quota, and the route
 * handler sets an hour of edge caching, so a reload re-fetches almost for free. Session
 * memory is the right lifetime.
 *
 * The two TTLs mirror the policy the previous frontend arrived at. A hit is held for ten
 * minutes, long enough to cover replaying a track or reopening the pane. A miss is held for
 * only three, because a miss is often a transient upstream failure rather than a permanent
 * absence, and pinning "no lyrics" onto a track for the whole session would mean one bad
 * request never healed.
 */
const HIT_TTL_MS = 10 * 60 * 1000;
const MISS_TTL_MS = 3 * 60 * 1000;

interface Entry {
  lyrics: Lyrics;
  expires: number;
}

interface LyricsCacheState {
  entries: Record<string, Entry>;
  /** Ids with a request in flight, so two panes cannot fetch the same track twice. */
  pending: Record<string, true>;

  /** Cached lyrics for a track, or null when absent or stale. */
  get: (songId: string) => Lyrics | null;
  isPending: (songId: string) => boolean;
  markPending: (songId: string) => void;
  set: (songId: string, lyrics: Lyrics) => void;
  clearPending: (songId: string) => void;
}

export const useLyricsCache = create<LyricsCacheState>((set, get) => ({
  entries: {},
  pending: {},

  get: (songId) => {
    const entry = get().entries[songId];
    if (!entry) return null;
    // Expiry is checked on read rather than swept on a timer. There is no reason to hold a
    // timer open for a cache whose entries are only ever looked at on demand.
    if (entry.expires < Date.now()) return null;
    return entry.lyrics;
  },

  isPending: (songId) => get().pending[songId] === true,

  markPending: (songId) => set((state) => ({ pending: { ...state.pending, [songId]: true } })),

  set: (songId, lyrics) =>
    set((state) => {
      const rest = { ...state.pending };
      delete rest[songId];
      return {
        entries: {
          ...state.entries,
          [songId]: {
            lyrics,
            expires:
              Date.now() +
              // An instrumental is a definite, permanent fact about the recording, so it is
              // held for the longer window alongside real hits. Only "none" gets the short
              // one, since that is the answer most likely to be wrong.
              (lyrics.kind === 'none' ? MISS_TTL_MS : HIT_TTL_MS),
          },
        },
        pending: rest,
      };
    }),

  clearPending: (songId) =>
    set((state) => {
      const rest = { ...state.pending };
      delete rest[songId];
      return { pending: rest };
    }),
}));
