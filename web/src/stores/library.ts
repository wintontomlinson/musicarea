'use client';

import { create } from 'zustand';
import type { CollectionCard, Song } from '@/lib/types';
import { readJson, writeJson } from '@/lib/repositories/localStore';

const LIBRARY_KEY = 'musicarea:library:v1';
const HISTORY_LIMIT = 120;

export interface HistoryItem {
  song: Song;
  /** Epoch milliseconds of the most recent play. */
  at: number;
  /** How many times this track has started playing on this device. */
  plays: number;
}

export interface CollectionRef {
  id: string;
  name: string;
  type: 'album' | 'artist' | 'playlist';
  image?: Song['image'];
  subtitle?: string;
  /** Epoch milliseconds when it was saved. */
  at: number;
}

export interface LocalPlaylist {
  id: string;
  name: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
  songs: Song[];
}

interface PersistedLibrary {
  songs: Song[];
  collections: CollectionRef[];
  history: HistoryItem[];
  playlists: LocalPlaylist[];
}

const EMPTY: PersistedLibrary = { songs: [], collections: [], history: [], playlists: [] };

/**
 * Reduce a song to what the library actually needs.
 *
 * Stream URLs are deliberately dropped: they are long, they expire, and the
 * audio engine already resolves a fresh URL by id when one is missing. Keeping
 * them would multiply the stored size for no benefit.
 */
function slim(song: Song): Song {
  return {
    id: song.id,
    name: song.name,
    type: 'song',
    duration: song.duration ?? null,
    year: song.year ?? null,
    language: song.language,
    explicitContent: song.explicitContent,
    image: song.image,
    album: song.album,
    artists: song.artists?.primary?.length
      ? { primary: song.artists.primary.slice(0, 3) }
      : song.artists?.all?.length
        ? { primary: song.artists.all.slice(0, 3) }
        : undefined,
  };
}

function load(): PersistedLibrary {
  const raw = readJson<Partial<PersistedLibrary>>(LIBRARY_KEY, EMPTY);
  return {
    songs: Array.isArray(raw.songs) ? raw.songs.filter(isSongLike) : [],
    collections: Array.isArray(raw.collections)
      ? raw.collections.filter((entry) => entry && typeof entry.id === 'string')
      : [],
    history: Array.isArray(raw.history)
      ? raw.history.filter((entry) => entry && isSongLike(entry.song))
      : [],
    playlists: Array.isArray(raw.playlists)
      ? raw.playlists
          .filter((entry) => entry && typeof entry.id === 'string')
          .map((entry) => ({ ...entry, songs: (entry.songs ?? []).filter(isSongLike) }))
      : [],
  };
}

function isSongLike(value: unknown): value is Song {
  return Boolean(value && typeof (value as Song).id === 'string' && (value as Song).name);
}

export interface LibraryState extends PersistedLibrary {
  /** False until localStorage has been read on the client. */
  hydrated: boolean;
  hydrate: () => void;

  isFavoriteSong: (id: string) => boolean;
  toggleFavoriteSong: (song: Song) => boolean;

  isFavoriteCollection: (id: string) => boolean;
  toggleFavoriteCollection: (card: CollectionCard | CollectionRef) => boolean;
  collectionsOfType: (type: CollectionRef['type']) => CollectionRef[];

  recordPlay: (song: Song) => void;
  clearHistory: () => void;

  createPlaylist: (name: string, description?: string) => string;
  updatePlaylist: (id: string, patch: { name?: string; description?: string }) => void;
  deletePlaylist: (id: string) => void;
  addToPlaylist: (id: string, songs: Song[]) => number;
  removeFromPlaylist: (playlistId: string, songId: string) => void;
  reorderPlaylist: (playlistId: string, from: number, to: number) => void;
  getPlaylist: (id: string) => LocalPlaylist | undefined;

  reset: () => void;
}

/**
 * On-device library: favourites, listening history and playlists.
 *
 * Everything here is local to the browser. The Flask API exposes no read or
 * write endpoints for a user library, so this store is the whole truth, and the
 * interface says so rather than implying an account.
 */
export const useLibrary = create<LibraryState>((set, get) => {
  /** Write the persistable slice after every mutation. */
  function persist(next: Partial<PersistedLibrary>) {
    const state = { ...get(), ...next };
    writeJson(LIBRARY_KEY, {
      songs: state.songs,
      collections: state.collections,
      history: state.history,
      playlists: state.playlists,
    });
  }

  return {
    ...EMPTY,
    hydrated: false,

    hydrate: () => {
      if (get().hydrated) return;
      set({ ...load(), hydrated: true });
    },

    isFavoriteSong: (id) => get().songs.some((song) => song.id === id),

    toggleFavoriteSong: (song) => {
      const exists = get().songs.some((entry) => entry.id === song.id);
      const songs = exists
        ? get().songs.filter((entry) => entry.id !== song.id)
        : [slim(song), ...get().songs];
      set({ songs });
      persist({ songs });
      return !exists;
    },

    isFavoriteCollection: (id) => get().collections.some((entry) => entry.id === id),

    toggleFavoriteCollection: (card) => {
      const exists = get().collections.some((entry) => entry.id === card.id);
      if (exists) {
        const collections = get().collections.filter((entry) => entry.id !== card.id);
        set({ collections });
        persist({ collections });
        return false;
      }

      const type = (card.type === 'artist' || card.type === 'playlist' ? card.type : 'album') as
        CollectionRef['type'];
      const entry: CollectionRef = {
        id: card.id,
        name: card.name,
        type,
        image: card.image,
        subtitle: 'subtitle' in card ? card.subtitle : undefined,
        at: Date.now(),
      };
      const collections = [entry, ...get().collections];
      set({ collections });
      persist({ collections });
      return true;
    },

    collectionsOfType: (type) => get().collections.filter((entry) => entry.type === type),

    recordPlay: (song) => {
      const existing = get().history.find((entry) => entry.song.id === song.id);
      const item: HistoryItem = {
        song: slim(song),
        at: Date.now(),
        plays: (existing?.plays ?? 0) + 1,
      };
      // Most recent first, one entry per track, oldest trimmed away.
      const history = [item, ...get().history.filter((entry) => entry.song.id !== song.id)].slice(
        0,
        HISTORY_LIMIT,
      );
      set({ history });
      persist({ history });
    },

    clearHistory: () => {
      set({ history: [] });
      persist({ history: [] });
    },

    createPlaylist: (name, description) => {
      const id = `pl_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
      const now = Date.now();
      const playlist: LocalPlaylist = {
        id,
        name: name.trim().slice(0, 80) || 'Untitled playlist',
        description: description?.trim().slice(0, 300) || undefined,
        createdAt: now,
        updatedAt: now,
        songs: [],
      };
      const playlists = [playlist, ...get().playlists];
      set({ playlists });
      persist({ playlists });
      return id;
    },

    updatePlaylist: (id, patch) => {
      const playlists = get().playlists.map((playlist) =>
        playlist.id === id
          ? {
              ...playlist,
              name: patch.name !== undefined ? patch.name.trim().slice(0, 80) || playlist.name : playlist.name,
              description:
                patch.description !== undefined
                  ? patch.description.trim().slice(0, 300) || undefined
                  : playlist.description,
              updatedAt: Date.now(),
            }
          : playlist,
      );
      set({ playlists });
      persist({ playlists });
    },

    deletePlaylist: (id) => {
      const playlists = get().playlists.filter((playlist) => playlist.id !== id);
      set({ playlists });
      persist({ playlists });
    },

    addToPlaylist: (id, songs) => {
      let added = 0;
      const playlists = get().playlists.map((playlist) => {
        if (playlist.id !== id) return playlist;
        const known = new Set(playlist.songs.map((song) => song.id));
        // Silently skip duplicates rather than growing the list with repeats.
        const incoming = songs.filter((song) => !known.has(song.id)).map(slim);
        added = incoming.length;
        return incoming.length
          ? { ...playlist, songs: [...playlist.songs, ...incoming], updatedAt: Date.now() }
          : playlist;
      });
      set({ playlists });
      persist({ playlists });
      return added;
    },

    removeFromPlaylist: (playlistId, songId) => {
      const playlists = get().playlists.map((playlist) =>
        playlist.id === playlistId
          ? {
              ...playlist,
              songs: playlist.songs.filter((song) => song.id !== songId),
              updatedAt: Date.now(),
            }
          : playlist,
      );
      set({ playlists });
      persist({ playlists });
    },

    reorderPlaylist: (playlistId, from, to) => {
      const playlists = get().playlists.map((playlist) => {
        if (playlist.id !== playlistId) return playlist;
        if (
          from === to ||
          from < 0 ||
          to < 0 ||
          from >= playlist.songs.length ||
          to >= playlist.songs.length
        ) {
          return playlist;
        }
        const songs = [...playlist.songs];
        const [moved] = songs.splice(from, 1);
        songs.splice(to, 0, moved);
        return { ...playlist, songs, updatedAt: Date.now() };
      });
      set({ playlists });
      persist({ playlists });
    },

    getPlaylist: (id) => get().playlists.find((playlist) => playlist.id === id),

    reset: () => {
      set({ ...EMPTY });
      persist(EMPTY);
    },
  };
});
