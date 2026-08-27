'use client';

import { create } from 'zustand';
import type { Song } from '@/lib/types';

const LIBRARY_KEY = 'musicarea:library:v1';

/** Favourites are unbounded in spirit but capped so storage cannot run away. */
const MAX_LIKED = 500;
/** Recently played keeps a short tail, like every other player. */
const MAX_RECENT = 60;

interface PersistedLibrary {
  liked: Song[];
  recent: Song[];
  /**
   * When each song was last played, as epoch milliseconds keyed by song id.
   *
   * Kept as a side map rather than as a field on the stored songs, so the `Song`
   * records stay pure catalogue data and no consumer has to deal with a shape that
   * is a song in some places and a song-plus-metadata in others.
   *
   * The recommender needs these. It decays every history event by age, and an entry
   * with no timestamp is explicitly weighted down to 0.35 as "unknown age: count it,
   * but quietly". Sending real timestamps is the difference between the personalised
   * feed treating a listener's history as a strong signal and treating all of it as
   * a vague one.
   */
  playedAt: Record<string, number>;
  /** When each song was liked, same units and reasoning as `playedAt`. */
  likedAt: Record<string, number>;
}

const EMPTY: PersistedLibrary = { liked: [], recent: [], playedAt: {}, likedAt: {} };

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
    const liked = sanitise(parsed.liked).slice(0, MAX_LIKED);
    const recent = sanitise(parsed.recent).slice(0, MAX_RECENT);
    // Records written before timestamps existed simply have none. They stay usable
    // and are treated as unknown-age by the recommender, which is correct: we do not
    // know when they were played, and inventing a timestamp would be worse than
    // admitting that.
    return {
      liked,
      recent,
      playedAt: sanitiseStamps(parsed.playedAt, recent),
      likedAt: sanitiseStamps(parsed.likedAt, liked),
    };
  } catch {
    return EMPTY;
  }
}

/**
 * Keep only timestamps whose song is still in the list.
 *
 * Without this the maps would grow forever: the lists are capped, so a song can
 * fall off the end of `recent` while its timestamp stays behind, and localStorage
 * would slowly fill with keys for songs the app can no longer name.
 */
function sanitiseStamps(
  value: unknown,
  keep: Song[],
): Record<string, number> {
  if (!value || typeof value !== 'object') return {};
  const ids = new Set(keep.map((song) => song.id));
  const out: Record<string, number> = {};
  for (const [id, at] of Object.entries(value as Record<string, unknown>)) {
    if (ids.has(id) && typeof at === 'number' && Number.isFinite(at)) out[id] = at;
  }
  return out;
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

/**
 * Narrow the store down to the fields that belong on disk.
 *
 * Every mutation persists through this rather than assembling an object literal.
 * The previous form passed `{ liked, recent }` from each action, which meant adding
 * a fifth persisted field would have required remembering to thread it through five
 * separate call sites, and forgetting one would silently drop data on the next write.
 */
function persistedSlice(state: LibraryState): PersistedLibrary {
  return {
    liked: state.liked,
    recent: state.recent,
    playedAt: state.playedAt,
    likedAt: state.likedAt,
  };
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
    const { liked, likedAt } = get();
    const exists = liked.some((s) => s.id === song.id);
    // Newest first, so the favourites screen reads most-recently-loved down.
    const nextLiked = exists
      ? liked.filter((s) => s.id !== song.id)
      : [slim(song), ...liked].slice(0, MAX_LIKED);
    const nextLikedAt = { ...likedAt };
    if (exists) delete nextLikedAt[song.id];
    else nextLikedAt[song.id] = Date.now();
    set({ liked: nextLiked, likedAt: nextLikedAt });
    persist(persistedSlice(get()));
  },

  removeLiked: (id) => {
    get().hydrate();
    const { liked, likedAt } = get();
    const nextLikedAt = { ...likedAt };
    delete nextLikedAt[id];
    set({ liked: liked.filter((s) => s.id !== id), likedAt: nextLikedAt });
    persist(persistedSlice(get()));
  },

  clearLiked: () => {
    get().hydrate();
    set({ liked: [], likedAt: {} });
    persist(persistedSlice(get()));
  },

  recordPlay: (song) => {
    get().hydrate();
    const { recent, playedAt } = get();
    // The timestamp is refreshed before the head guard below, not after it. A track
    // on repeat should not create a new list entry, but it genuinely was played
    // again, and the recency of that is what the recommender decays against.
    const nextPlayedAt = { ...playedAt, [song.id]: Date.now() };
    // Replaying the track already at the head is not a new entry, otherwise
    // repeat-one would fill the whole list with one song.
    if (recent[0]?.id === song.id) {
      set({ playedAt: nextPlayedAt });
      persist(persistedSlice(get()));
      return;
    }
    const nextRecent = [slim(song), ...recent.filter((s) => s.id !== song.id)].slice(0, MAX_RECENT);
    // A song pushed off the end of the capped list takes its timestamp with it.
    const kept = new Set(nextRecent.map((entry) => entry.id));
    for (const id of Object.keys(nextPlayedAt)) {
      if (!kept.has(id)) delete nextPlayedAt[id];
    }
    set({ recent: nextRecent, playedAt: nextPlayedAt });
    persist(persistedSlice(get()));
  },

  clearRecent: () => {
    get().hydrate();
    set({ recent: [], playedAt: {} });
    persist(persistedSlice(get()));
  },
}));
