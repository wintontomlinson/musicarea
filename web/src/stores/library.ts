'use client';

import { create } from 'zustand';
import type { Song } from '@/lib/types';
import { useHistory } from './history';

const LIBRARY_KEY = 'musicarea:library:v1';

/** Favourites are unbounded in spirit but capped so storage cannot run away. */
const MAX_LIKED = 500;
/** Recently played keeps a short tail, like every other player. */
const MAX_RECENT = 60;

interface PersistedLibrary {
  liked: Song[];
  recent: Song[];
}

const EMPTY: PersistedLibrary = { liked: [], recent: [] };

/**
 * Store a reduced record of each song.
 *
 * `downloadUrl` is deliberately dropped: the arrays hold five URLs per track and
 * signed CDN links expire anyway, so keeping them would bloat localStorage with
 * values that go stale. The audio engine already resolves a stream on demand via
 * `/api/song/[id]` when a queued track arrives without one, which is exactly the
 * case a stored song hits.
 *
 * `recommendation` is dropped too: it describes why a track was surfaced in one
 * particular feed, which is meaningless once the song is saved.
 */
function slim(song: Song): Song {
  const { downloadUrl: _downloadUrl, recommendation: _recommendation, ...rest } = song;
  return rest;
}

function load(): PersistedLibrary {
  if (typeof window === 'undefined') return EMPTY;
  try {
    const raw = localStorage.getItem(LIBRARY_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<PersistedLibrary>;
    return {
      liked: sanitise(parsed.liked).slice(0, MAX_LIKED),
      recent: sanitise(parsed.recent).slice(0, MAX_RECENT),
    };
  } catch {
    return EMPTY;
  }
}

/** Drop anything that is not a usable song record, so one bad write cannot
 *  break every screen that reads the library. */
function sanitise(list: unknown): Song[] {
  if (!Array.isArray(list)) return [];
  return list.filter(
    (item): item is Song =>
      !!item && typeof item === 'object' && typeof (item as Song).id === 'string' && !!(item as Song).id,
  );
}

function persist(state: PersistedLibrary) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LIBRARY_KEY, JSON.stringify(state));
  } catch {
    /* quota or unavailable */
  }
}

export interface LibraryState extends PersistedLibrary {
  /**
   * False during SSR and until the client reads localStorage. Screens must wait
   * on this before rendering counts or lists, otherwise the server markup (an
   * empty library) and the first client render disagree and React discards the
   * tree with a hydration error.
   */
  hydrated: boolean;

  hydrate: () => void;
  isLiked: (id: string) => boolean;
  toggleLike: (song: Song) => void;
  removeLiked: (id: string) => void;
  clearLiked: () => void;
  recordPlay: (song: Song) => void;
  clearRecent: () => void;
}

export const useLibrary = create<LibraryState>((set, get) => ({
  ...EMPTY,
  hydrated: false,

  hydrate: () => {
    if (get().hydrated) return;
    set({ ...load(), hydrated: true });
  },

  isLiked: (id) => get().liked.some((s) => s.id === id),

  toggleLike: (song) => {
    // Every mutation hydrates first. Writing from the un-hydrated initial state
    // would persist an empty library over whatever is already on disk, and
    // playback can begin before any screen that reads the library has mounted.
    get().hydrate();
    const { liked, recent } = get();
    const exists = liked.some((s) => s.id === song.id);
    // Only a like is recorded, never an unlike. Removing a favourite means "this
    // no longer belongs in my list", not "I dislike this", and the log is
    // append-only so there is nothing to take back.
    if (!exists) useHistory.getState().log(song, 'like');
    // Newest first, so the favourites screen reads most-recently-loved down.
    const nextLiked = exists
      ? liked.filter((s) => s.id !== song.id)
      : [slim(song), ...liked].slice(0, MAX_LIKED);
    set({ liked: nextLiked });
    persist({ liked: nextLiked, recent });
  },

  removeLiked: (id) => {
    get().hydrate();
    const { liked, recent } = get();
    const nextLiked = liked.filter((s) => s.id !== id);
    set({ liked: nextLiked });
    persist({ liked: nextLiked, recent });
  },

  clearLiked: () => {
    get().hydrate();
    const { recent } = get();
    set({ liked: [] });
    persist({ liked: [], recent });
  },

  recordPlay: (song) => {
    get().hydrate();
    const { liked, recent } = get();
    // Replaying the track already at the head is not a new entry, otherwise
    // repeat-one would fill the whole list with one song.
    if (recent[0]?.id === song.id) return;
    const nextRecent = [slim(song), ...recent.filter((s) => s.id !== song.id)].slice(0, MAX_RECENT);
    set({ recent: nextRecent });
    persist({ liked, recent: nextRecent });
  },

  clearRecent: () => {
    get().hydrate();
    const { liked } = get();
    set({ recent: [] });
    persist({ liked, recent: [] });
  },
}));
