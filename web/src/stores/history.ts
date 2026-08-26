'use client';

import { create } from 'zustand';
import { EVENT_WEIGHTS, type HistoryEntry, type ListeningEvent, type Song } from '@/lib/types';

const HISTORY_KEY = 'musicarea:history:v1';

/**
 * Matches the server's own cap: `_history()` keeps only the newest 400 entries
 * and silently discards the rest, so sending more is wasted payload.
 */
const MAX_HISTORY = 400;

/** Long-term decay, mirroring HALF_LIFE_DAYS in recommender.py. */
const HALF_LIFE_DAYS = 21;
/** Denominator behind `strength`, mirroring recommender.py. */
const STRENGTH_SCALE = 25;
const DAY_MS = 86_400_000;

/**
 * The listening event log that drives the recommendation engine.
 *
 * The engine is entirely server side but stateless: it has no accounts and no
 * database, so the profile is rebuilt on every request from the log the browser
 * sends it. That makes this store the input to the whole algorithm. Before it
 * existed the frontend posted `history: []` on every feed request, which meant
 * `coldStart` was permanently true, four of the five shelves were never emitted
 * and the ranking had nothing to rank by.
 *
 * The log is append-only: one row per event, never aggregated, because the
 * engine needs each event's own kind and timestamp to weight and decay it.
 */
interface PersistedHistory {
  entries: HistoryEntry[];
}

const EMPTY: PersistedHistory = { entries: [] };

/**
 * Reduce a song to the fields the server actually keeps.
 *
 * `_history()` copies only id, name, language, year, playCount, event, at and
 * artists[{id,name}], and discards everything else, so anything more is dead
 * weight on the wire. That matters because the body limit is 128 KiB and the
 * whole log is posted on every feed, mixes and mood request: at 400 entries the
 * budget is roughly 300 bytes each. `image`, `duration` and `downloadUrl` would
 * blow through it on their own, and `album` is stripped server side too.
 */
function toEntry(song: Song, event: ListeningEvent): HistoryEntry {
  const credits = song.artists?.primary?.length ? song.artists.primary : song.artists?.all ?? [];
  const entry: HistoryEntry = { id: song.id, event, at: Date.now() };
  if (song.name) entry.name = song.name;
  if (song.language) entry.language = song.language;
  if (song.year !== undefined && song.year !== null) entry.year = song.year;
  if (typeof song.playCount === 'number') entry.playCount = song.playCount;
  const artists = credits
    .filter((a) => typeof a.id === 'string' && a.id)
    .slice(0, 12)
    .map((a) => ({ id: a.id, name: a.name ?? '' }));
  if (artists.length) entry.artists = artists;
  return entry;
}

function load(): PersistedHistory {
  if (typeof window === 'undefined') return EMPTY;
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<PersistedHistory>;
    if (!Array.isArray(parsed.entries)) return EMPTY;
    const entries = parsed.entries
      .filter((e): e is HistoryEntry => !!e && typeof e.id === 'string' && !!e.id)
      .slice(-MAX_HISTORY);
    return { entries };
  } catch {
    return EMPTY;
  }
}

function persist(entries: HistoryEntry[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify({ entries }));
  } catch {
    /* quota or unavailable */
  }
}

/**
 * Approximate the server's `strength` locally.
 *
 * Only used to fill the taste meter before the first feed response arrives; once
 * the server reports its own figure, that wins. Kept in step with
 * `build_profile`: decayed positive weight over 25, clamped to 0..1. Negative
 * events are excluded, matching the server, which routes them into an artist
 * penalty rather than the positive total.
 */
function localStrength(entries: HistoryEntry[], now = Date.now()): number {
  let total = 0;
  for (const entry of entries) {
    const weight = EVENT_WEIGHTS[entry.event ?? 'play'] ?? 1;
    if (weight <= 0) continue;
    // A missing timestamp is counted, but quietly, as the server does.
    const decay = entry.at ? 0.5 ** ((now - entry.at) / DAY_MS / HALF_LIFE_DAYS) : 0.35;
    total += weight * decay;
  }
  return Math.max(0, Math.min(1, total / STRENGTH_SCALE));
}

export interface HistoryState {
  entries: HistoryEntry[];
  hydrated: boolean;
  /**
   * Bumped whenever the log changes, so feed consumers can invalidate their
   * cache without diffing a 400-entry array.
   */
  revision: number;

  hydrate: () => void;
  log: (song: Song, event: ListeningEvent) => void;
  /** The payload for `POST /api/feed`, newest last as the server expects. */
  payload: () => HistoryEntry[];
  /** Local estimate of taste strength, 0..1. */
  strength: () => number;
  clear: () => void;
}

export const useHistory = create<HistoryState>((set, get) => ({
  ...EMPTY,
  hydrated: false,
  revision: 0,

  hydrate: () => {
    if (get().hydrated) return;
    const loaded = load();
    set({ entries: loaded.entries, hydrated: true, revision: get().revision + 1 });
  },

  log: (song, event) => {
    if (!song?.id) return;
    // Hydrate first: playback can start before any screen that reads the log has
    // mounted, and writing from the empty initial state would erase it.
    get().hydrate();
    const entries = [...get().entries, toEntry(song, event)].slice(-MAX_HISTORY);
    set({ entries, revision: get().revision + 1 });
    persist(entries);
  },

  payload: () => get().entries,

  strength: () => localStrength(get().entries),

  clear: () => {
    set({ entries: [], revision: get().revision + 1 });
    persist([]);
  },
}));
