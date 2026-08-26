'use client';

import { create } from 'zustand';
import type { Song } from '@/lib/types';
import { sanitiseSongs, slimSong } from '@/lib/slimSong';
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

function load(): PersistedLibrary {
  if (typeof window === 'undefined') return EMPTY;
  try {
    const raw = localStorage.getItem(LIBRARY_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<PersistedLibrary>;
    return {
      liked: sanitiseSongs(parsed.liked).slice(0, MAX_LIKED),
      recent: sanitiseSongs(parsed.recent).slice(0, MAX_RECENT),
    };
  } catch {
    return EMPTY;
  }
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
      : [slimSong(song), ...liked].slice(0, MAX_LIKED);
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
    const nextRecent = [slimSong(song), ...recent.filter((s) => s.id !== song.id)].slice(0, MAX_RECENT);
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
