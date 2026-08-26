'use client';

import { create } from 'zustand';
import type { Song } from '@/lib/types';
import { sanitiseSongs, slimSong } from '@/lib/slimSong';
import { useHistory } from './history';

const PLAYLISTS_KEY = 'musicarea:playlists:v1';

const MAX_PLAYLISTS = 60;
const MAX_SONGS_PER_PLAYLIST = 500;
const MAX_NAME_LENGTH = 60;

export interface UserPlaylist {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  songs: Song[];
}

interface PersistedPlaylists {
  playlists: UserPlaylist[];
}

const EMPTY: PersistedPlaylists = { playlists: [] };

/**
 * Playlists the listener builds, kept on this device.
 *
 * Distinct from the catalogue playlists under `/playlist/[id]`, which are
 * editorial and fetched from the API. These have no server to live on, which is
 * also why they get their own route namespace under `/library` rather than
 * sharing one where a local id and a catalogue id could collide.
 */
function newId(): string {
  // Random is enough: these ids never leave the device and never need to be
  // reproducible, they only have to not collide within one browser.
  return `pl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function cleanName(name: string, fallback = 'New playlist'): string {
  const trimmed = name.trim().replace(/\s+/g, ' ').slice(0, MAX_NAME_LENGTH);
  return trimmed || fallback;
}

function load(): PersistedPlaylists {
  if (typeof window === 'undefined') return EMPTY;
  try {
    const raw = localStorage.getItem(PLAYLISTS_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<PersistedPlaylists>;
    if (!Array.isArray(parsed.playlists)) return EMPTY;
    const playlists = parsed.playlists
      .filter((p): p is UserPlaylist => !!p && typeof p === 'object' && typeof p.id === 'string' && !!p.id)
      .slice(0, MAX_PLAYLISTS)
      .map((p) => ({
        id: p.id,
        name: cleanName(typeof p.name === 'string' ? p.name : ''),
        createdAt: typeof p.createdAt === 'number' ? p.createdAt : Date.now(),
        updatedAt: typeof p.updatedAt === 'number' ? p.updatedAt : Date.now(),
        songs: sanitiseSongs(p.songs).slice(0, MAX_SONGS_PER_PLAYLIST),
      }));
    return { playlists };
  } catch {
    return EMPTY;
  }
}

function persist(playlists: UserPlaylist[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(PLAYLISTS_KEY, JSON.stringify({ playlists }));
  } catch {
    /* quota or unavailable */
  }
}

export type AddResult = 'added' | 'duplicate' | 'full' | 'missing';

export interface PlaylistsState extends PersistedPlaylists {
  hydrated: boolean;

  hydrate: () => void;
  byId: (id: string) => UserPlaylist | undefined;
  /** Create a playlist, optionally seeded with tracks. Returns its id. */
  create: (name: string, songs?: Song[]) => string;
  rename: (id: string, name: string) => void;
  remove: (id: string) => void;
  /** Add one track. Reports why nothing happened when it did not. */
  addSong: (id: string, song: Song) => AddResult;
  removeSong: (id: string, songId: string) => void;
  /** True when the playlist already holds that track. */
  contains: (id: string, songId: string) => boolean;
}

export const usePlaylists = create<PlaylistsState>((set, get) => ({
  ...EMPTY,
  hydrated: false,

  hydrate: () => {
    if (get().hydrated) return;
    set({ ...load(), hydrated: true });
  },

  byId: (id) => get().playlists.find((p) => p.id === id),

  contains: (id, songId) => !!get().byId(id)?.songs.some((s) => s.id === songId),

  create: (name, songs = []) => {
    // Mutations hydrate first: a playlist can be created from a track row before
    // any screen that reads storage has mounted, and writing from the empty
    // initial state would wipe every existing playlist.
    get().hydrate();
    const id = newId();
    const now = Date.now();
    const playlist: UserPlaylist = {
      id,
      name: cleanName(name),
      createdAt: now,
      updatedAt: now,
      songs: songs.slice(0, MAX_SONGS_PER_PLAYLIST).map(slimSong),
    };
    // Newest first, matching how the sidebar and library list read.
    const playlists = [playlist, ...get().playlists].slice(0, MAX_PLAYLISTS);
    set({ playlists });
    persist(playlists);
    for (const song of playlist.songs) useHistory.getState().log(song, 'playlist_add');
    return id;
  },

  rename: (id, name) => {
    get().hydrate();
    const playlists = get().playlists.map((p) =>
      p.id === id ? { ...p, name: cleanName(name, p.name), updatedAt: Date.now() } : p,
    );
    set({ playlists });
    persist(playlists);
  },

  remove: (id) => {
    get().hydrate();
    const playlists = get().playlists.filter((p) => p.id !== id);
    set({ playlists });
    persist(playlists);
  },

  addSong: (id, song) => {
    get().hydrate();
    const target = get().byId(id);
    if (!target || !song?.id) return 'missing';
    // Silently adding a duplicate is worse than refusing: the listener would end
    // up with the same track twice and no idea why.
    if (target.songs.some((s) => s.id === song.id)) return 'duplicate';
    if (target.songs.length >= MAX_SONGS_PER_PLAYLIST) return 'full';

    const playlists = get().playlists.map((p) =>
      p.id === id ? { ...p, songs: [...p.songs, slimSong(song)], updatedAt: Date.now() } : p,
    );
    set({ playlists });
    persist(playlists);
    // Putting a track in a playlist is a deliberate, durable choice, so it is a
    // strong taste signal (weight 2.0, above a play or a queue).
    useHistory.getState().log(song, 'playlist_add');
    return 'added';
  },

  removeSong: (id, songId) => {
    get().hydrate();
    const playlists = get().playlists.map((p) =>
      p.id === id
        ? { ...p, songs: p.songs.filter((s) => s.id !== songId), updatedAt: Date.now() }
        : p,
    );
    set({ playlists });
    persist(playlists);
  },
}));
