'use client';

import { create } from 'zustand';
import type { Song } from '@/lib/types';

/**
 * Playlists the listener creates on this device.
 *
 * These exist because the brief asked for a Downloads tab and for collaborative playlists,
 * neither of which this app can honestly provide: there is no service worker or cache storage
 * for offline audio, and no accounts or server for collaboration. Local playlists are the
 * nearest thing that is genuinely real, and they fill the same slot in the Library.
 *
 * Everything is localStorage, like the rest of the library. That means they are per-browser and
 * do not sync, which the UI states plainly rather than implying a cloud that does not exist.
 */
const KEY = 'musicarea:playlists:v1';

/** Enough to be a library, bounded so one listener cannot exhaust the storage quota. */
const MAX_PLAYLISTS = 60;
const MAX_SONGS_PER_PLAYLIST = 500;
const MAX_NAME_LENGTH = 60;

export interface LocalPlaylist {
  id: string;
  name: string;
  /** Epoch ms. Used for ordering and for the "created" line in the UI. */
  createdAt: number;
  updatedAt: number;
  songs: Song[];
}

/**
 * Strip fields that must not be persisted.
 *
 * Identical reasoning to the library store: `downloadUrl` holds five signed CDN links per track
 * that expire anyway, and the audio engine re-resolves a stream on demand through
 * `/api/song/[id]` when a queued track arrives without one. `recommendation` describes why a
 * track appeared in one particular feed, which is meaningless once it is saved by hand.
 */
function slim(song: Song): Song {
  const { downloadUrl: _downloadUrl, recommendation: _recommendation, ...rest } = song;
  return rest;
}

function newId(): string {
  // `crypto.randomUUID` is unavailable on http origins in some browsers, and these ids only need
  // to be unique within one device's localStorage.
  return `pl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function load(): LocalPlaylist[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isPlaylist).slice(0, MAX_PLAYLISTS);
  } catch {
    return [];
  }
}

/** One malformed write must not break every screen that reads playlists. */
function isPlaylist(value: unknown): value is LocalPlaylist {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Partial<LocalPlaylist>;
  return (
    typeof entry.id === 'string' &&
    !!entry.id &&
    typeof entry.name === 'string' &&
    Array.isArray(entry.songs)
  );
}

function persist(playlists: LocalPlaylist[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(KEY, JSON.stringify(playlists));
  } catch {
    /* quota or unavailable */
  }
}

interface PlaylistState {
  playlists: LocalPlaylist[];
  hydrated: boolean;

  hydrate: () => void;
  get: (id: string) => LocalPlaylist | undefined;
  /** Returns the new playlist's id, so the caller can navigate to it. */
  create: (name: string, songs?: Song[]) => string | null;
  rename: (id: string, name: string) => void;
  remove: (id: string) => void;
  addSong: (id: string, song: Song) => void;
  removeSong: (id: string, songId: string) => void;
  /** True when the song is already in that playlist, for the add-to-playlist UI. */
  contains: (id: string, songId: string) => boolean;
}

export const usePlaylists = create<PlaylistState>((set, get) => ({
  playlists: [],
  hydrated: false,

  hydrate: () => {
    if (get().hydrated) return;
    set({ playlists: load(), hydrated: true });
  },

  get: (id) => get().playlists.find((playlist) => playlist.id === id),

  create: (name, songs = []) => {
    // Every mutation hydrates first. Writing from the un-hydrated initial state would persist an
    // empty list over whatever is already on disk.
    get().hydrate();
    const clean = name.trim().slice(0, MAX_NAME_LENGTH);
    if (!clean) return null;
    if (get().playlists.length >= MAX_PLAYLISTS) return null;
    const now = Date.now();
    const playlist: LocalPlaylist = {
      id: newId(),
      name: clean,
      createdAt: now,
      updatedAt: now,
      songs: songs.slice(0, MAX_SONGS_PER_PLAYLIST).map(slim),
    };
    // Newest first, matching how liked songs and history read.
    const next = [playlist, ...get().playlists];
    set({ playlists: next });
    persist(next);
    return playlist.id;
  },

  rename: (id, name) => {
    get().hydrate();
    const clean = name.trim().slice(0, MAX_NAME_LENGTH);
    if (!clean) return;
    const next = get().playlists.map((playlist) =>
      playlist.id === id ? { ...playlist, name: clean, updatedAt: Date.now() } : playlist,
    );
    set({ playlists: next });
    persist(next);
  },

  remove: (id) => {
    get().hydrate();
    const next = get().playlists.filter((playlist) => playlist.id !== id);
    set({ playlists: next });
    persist(next);
  },

  addSong: (id, song) => {
    get().hydrate();
    const next = get().playlists.map((playlist) => {
      if (playlist.id !== id) return playlist;
      // Silently ignored rather than duplicated. Adding the same track twice is nearly always a
      // double tap, and a playlist with one song listed twice looks broken.
      if (playlist.songs.some((entry) => entry.id === song.id)) return playlist;
      if (playlist.songs.length >= MAX_SONGS_PER_PLAYLIST) return playlist;
      // Appended, not prepended: a playlist has an intended running order, unlike the library's
      // reverse-chronological lists.
      return { ...playlist, songs: [...playlist.songs, slim(song)], updatedAt: Date.now() };
    });
    set({ playlists: next });
    persist(next);
  },

  removeSong: (id, songId) => {
    get().hydrate();
    const next = get().playlists.map((playlist) =>
      playlist.id === id
        ? {
            ...playlist,
            songs: playlist.songs.filter((entry) => entry.id !== songId),
            updatedAt: Date.now(),
          }
        : playlist,
    );
    set({ playlists: next });
    persist(next);
  },

  contains: (id, songId) =>
    get()
      .playlists.find((playlist) => playlist.id === id)
      ?.songs.some((entry) => entry.id === songId) ?? false,
}));
