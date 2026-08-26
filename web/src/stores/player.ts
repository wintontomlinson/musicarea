'use client';

import { create } from 'zustand';
import type { Song } from '@/lib/types';

export type RepeatMode = 'off' | 'all' | 'one';

interface PersistedPrefs {
  volume: number;
  muted: boolean;
  shuffle: boolean;
  repeat: RepeatMode;
  /** Keep playing with catalogue suggestions when the queue runs out. */
  autoplay: boolean;
}

const PREFS_KEY = 'musicarea:prefs:v1';
const QUEUE_KEY = 'musicarea:queue:v1';
/** Cap on persisted tracks, so a long radio session cannot fill localStorage. */
const QUEUE_PERSIST_LIMIT = 100;
const DEFAULT_PREFS: PersistedPrefs = {
  volume: 0.85,
  muted: false,
  shuffle: false,
  repeat: 'off',
  autoplay: true,
};

function loadPrefs(): PersistedPrefs {
  if (typeof window === 'undefined') return DEFAULT_PREFS;
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    return raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
}

function savePrefs(prefs: PersistedPrefs) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* quota or unavailable */
  }
}

interface PersistedQueue {
  queue: Song[];
  order: number[];
  orderPos: number;
}

function loadQueue(): PersistedQueue | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedQueue>;
    if (!Array.isArray(parsed.queue) || !parsed.queue.length) return null;

    const queue = parsed.queue.filter((song) => song && typeof song.id === 'string');
    if (!queue.length) return null;

    // Rebuild the play order defensively: a stored order that does not match the
    // stored queue would put the player into an unplayable state.
    const order =
      Array.isArray(parsed.order) &&
      parsed.order.length === queue.length &&
      parsed.order.every((index) => Number.isInteger(index) && index >= 0 && index < queue.length)
        ? parsed.order
        : queue.map((_, index) => index);

    const orderPos =
      typeof parsed.orderPos === 'number' && parsed.orderPos >= 0 && parsed.orderPos < order.length
        ? parsed.orderPos
        : 0;

    return { queue, order, orderPos };
  } catch {
    return null;
  }
}

function saveQueue(state: PersistedQueue) {
  if (typeof window === 'undefined') return;
  try {
    if (!state.queue.length) {
      localStorage.removeItem(QUEUE_KEY);
      return;
    }
    // Keep the window around the current track rather than the first N entries,
    // so what is coming up next survives the reload.
    const start = Math.max(0, Math.min(state.orderPos, state.queue.length - 1));
    const slice = state.queue.slice(0, QUEUE_PERSIST_LIMIT);
    const withinLimit = state.order.filter((index) => index < slice.length);
    localStorage.setItem(
      QUEUE_KEY,
      JSON.stringify({
        queue: slice,
        order: withinLimit.length ? withinLimit : slice.map((_, index) => index),
        orderPos: Math.min(start, Math.max(0, withinLimit.length - 1)),
      }),
    );
  } catch {
    /* quota or private mode: playback still works, it just will not persist */
  }
}

/** Persist the playback preferences from whatever the store currently holds. */
function persistPrefs(state: PersistedPrefs) {
  savePrefs({
    volume: state.volume,
    muted: state.muted,
    shuffle: state.shuffle,
    repeat: state.repeat,
    autoplay: state.autoplay,
  });
}

/** Fisher-Yates over indices, keeping a chosen index first. */
function shuffledOrder(length: number, first: number): number[] {
  const idx = Array.from({ length }, (_, i) => i).filter((i) => i !== first);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return [first, ...idx];
}

export interface PlayerState {
  /** The full queue in the order it was set (the "natural" order). */
  queue: Song[];
  /** Playback order into `queue`. With shuffle off this is 0..n-1. */
  order: number[];
  /** Position within `order` of the current track. */
  orderPos: number;

  isPlaying: boolean;
  /** True while a track's audio is loading. */
  isLoading: boolean;
  volume: number;
  muted: boolean;
  shuffle: boolean;
  repeat: RepeatMode;
  autoplay: boolean;
  currentTime: number;
  duration: number;

  /** True when the full-screen player is open. */
  fullscreen: boolean;
  /** True when the queue panel is open. */
  queueOpen: boolean;
  /** True when the lyrics panel is open. */
  lyricsOpen: boolean;
  /**
   * Human-readable description of the last playback failure, or null. Set by the
   * audio engine and surfaced in the player rather than the console.
   */
  error: string | null;

  // Selectors are derived in components; keep the state minimal here.
  currentTrack: () => Song | null;

  // Actions
  playQueue: (songs: Song[], startIndex?: number) => void;
  playNow: (song: Song) => void;
  toggle: () => void;
  setPlaying: (playing: boolean) => void;
  setLoading: (loading: boolean) => void;
  next: (auto?: boolean) => void;
  prev: () => void;
  playAt: (orderPos: number) => void;
  setVolume: (v: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  toggleAutoplay: () => void;
  setProgress: (currentTime: number, duration: number) => void;
  reorderQueue: (fromQueueIndex: number, toQueueIndex: number) => void;
  addToQueue: (song: Song) => void;
  playNext: (song: Song) => void;
  removeFromQueue: (queueIndex: number) => void;
  clearQueue: () => void;
  setFullscreen: (open: boolean) => void;
  setQueueOpen: (open: boolean) => void;
  setLyricsOpen: (open: boolean) => void;
  setError: (message: string | null) => void;
  /** Re-hydrate the last session's queue, paused. Called once on mount. */
  restoreQueue: () => void;
}

const initialPrefs = loadPrefs();

export const usePlayer = create<PlayerState>((set, get) => ({
  queue: [],
  order: [],
  orderPos: 0,
  isPlaying: false,
  isLoading: false,
  volume: initialPrefs.volume,
  muted: initialPrefs.muted,
  shuffle: initialPrefs.shuffle,
  repeat: initialPrefs.repeat,
  autoplay: initialPrefs.autoplay,
  currentTime: 0,
  duration: 0,
  fullscreen: false,
  queueOpen: false,
  lyricsOpen: false,
  error: null,

  currentTrack: () => {
    const { queue, order, orderPos } = get();
    const qi = order[orderPos];
    return qi !== undefined ? queue[qi] ?? null : null;
  },

  playQueue: (songs, startIndex = 0) => {
    if (!songs.length) return;
    const start = Math.max(0, Math.min(startIndex, songs.length - 1));
    const { shuffle } = get();
    const order = shuffle
      ? shuffledOrder(songs.length, start)
      : songs.map((_, i) => i);
    const orderPos = shuffle ? 0 : start;
    set({ queue: songs, order, orderPos, isPlaying: true, currentTime: 0, duration: 0 });
  },

  playNow: (song) => {
    // Start a one-track queue immediately.
    get().playQueue([song], 0);
  },

  toggle: () => set((s) => ({ isPlaying: !s.isPlaying })),
  setPlaying: (playing) => set({ isPlaying: playing }),
  setLoading: (loading) => set({ isLoading: loading }),

  next: (auto = false) => {
    const { order, orderPos, repeat } = get();
    if (!order.length) return;
    if (repeat === 'one' && auto) {
      // Re-trigger the same track by nudging currentTime; engine handles replay.
      set({ currentTime: 0 });
      return;
    }
    if (orderPos < order.length - 1) {
      set({ orderPos: orderPos + 1, currentTime: 0, duration: 0, isPlaying: true });
    } else if (repeat === 'all') {
      set({ orderPos: 0, currentTime: 0, duration: 0, isPlaying: true });
    } else {
      // End of queue.
      set({ isPlaying: false, currentTime: 0 });
    }
  },

  prev: () => {
    const { orderPos, currentTime } = get();
    // If more than 3s in, restart the current track (standard behavior).
    if (currentTime > 3) {
      set({ currentTime: 0 });
      return;
    }
    if (orderPos > 0) {
      set({ orderPos: orderPos - 1, currentTime: 0, duration: 0, isPlaying: true });
    } else {
      set({ currentTime: 0 });
    }
  },

  playAt: (orderPos) => {
    const { order } = get();
    if (orderPos < 0 || orderPos >= order.length) return;
    set({ orderPos, currentTime: 0, duration: 0, isPlaying: true });
  },

  setVolume: (v) => {
    const volume = Math.max(0, Math.min(1, v));
    const muted = volume === 0 ? get().muted : false;
    set({ volume, muted });
    persistPrefs(get());
  },

  toggleMute: () => {
    const muted = !get().muted;
    set({ muted });
    persistPrefs(get());
  },

  toggleShuffle: () => {
    const { shuffle, queue, order, orderPos } = get();
    const nextShuffle = !shuffle;
    if (!queue.length) {
      set({ shuffle: nextShuffle });
    } else {
      const currentQueueIndex = order[orderPos];
      if (nextShuffle) {
        const newOrder = shuffledOrder(queue.length, currentQueueIndex);
        set({ shuffle: true, order: newOrder, orderPos: 0 });
      } else {
        // Restore natural order and point at the current track's real position.
        const newOrder = queue.map((_, i) => i);
        set({ shuffle: false, order: newOrder, orderPos: currentQueueIndex });
      }
    }
    persistPrefs(get());
  },

  cycleRepeat: () => {
    const modes: RepeatMode[] = ['off', 'all', 'one'];
    const repeat = modes[(modes.indexOf(get().repeat) + 1) % modes.length];
    set({ repeat });
    persistPrefs(get());
  },

  toggleAutoplay: () => {
    set({ autoplay: !get().autoplay });
    persistPrefs(get());
  },

  setProgress: (currentTime, duration) => set({ currentTime, duration }),

  reorderQueue: (fromQueueIndex, toQueueIndex) => {
    const { queue, order, orderPos } = get();
    if (
      fromQueueIndex === toQueueIndex ||
      fromQueueIndex < 0 ||
      toQueueIndex < 0 ||
      fromQueueIndex >= queue.length ||
      toQueueIndex >= queue.length
    ) {
      return;
    }
    const currentQueueIndex = order[orderPos];
    const nextQueue = [...queue];
    const [moved] = nextQueue.splice(fromQueueIndex, 1);
    nextQueue.splice(toQueueIndex, 0, moved);

    // Rebuild order to reference the moved items, preserving which track plays.
    const { shuffle } = get();
    if (shuffle) {
      // Map old queue indices to new ones after the splice.
      const remap = (oldIdx: number): number => {
        if (oldIdx === fromQueueIndex) return toQueueIndex;
        let n = oldIdx;
        if (fromQueueIndex < oldIdx) n -= 1;
        if (toQueueIndex <= n) n += 1;
        return n;
      };
      const newOrder = order.map(remap);
      set({ queue: nextQueue, order: newOrder });
    } else {
      const newCurrent =
        currentQueueIndex === fromQueueIndex
          ? toQueueIndex
          : (() => {
              let n = currentQueueIndex;
              if (fromQueueIndex < currentQueueIndex) n -= 1;
              if (toQueueIndex <= n) n += 1;
              return n;
            })();
      set({
        queue: nextQueue,
        order: nextQueue.map((_, i) => i),
        orderPos: newCurrent,
      });
    }
  },

  addToQueue: (song) => {
    const { queue, order } = get();
    const nextQueue = [...queue, song];
    set({ queue: nextQueue, order: [...order, nextQueue.length - 1] });
  },

  playNext: (song) => {
    const { queue, order, orderPos } = get();
    const nextQueue = [...queue, song];
    const newQueueIndex = nextQueue.length - 1;
    const newOrder = [...order];
    newOrder.splice(orderPos + 1, 0, newQueueIndex);
    set({ queue: nextQueue, order: newOrder });
  },

  removeFromQueue: (queueIndex) => {
    const { queue, order, orderPos } = get();
    if (queueIndex < 0 || queueIndex >= queue.length) return;
    const currentQueueIndex = order[orderPos];
    if (queueIndex === currentQueueIndex) return; // never remove the playing track
    const nextQueue = queue.filter((_, i) => i !== queueIndex);
    const newOrder = order
      .filter((qi) => qi !== queueIndex)
      .map((qi) => (qi > queueIndex ? qi - 1 : qi));
    const newCurrentQueueIndex =
      currentQueueIndex > queueIndex ? currentQueueIndex - 1 : currentQueueIndex;
    const newOrderPos = newOrder.indexOf(newCurrentQueueIndex);
    set({ queue: nextQueue, order: newOrder, orderPos: Math.max(0, newOrderPos) });
  },

  clearQueue: () => {
    // Keep the currently playing track; drop everything else.
    const { queue, order, orderPos } = get();
    const currentQueueIndex = order[orderPos];
    const current = queue[currentQueueIndex];
    if (!current) {
      set({ queue: [], order: [], orderPos: 0 });
      return;
    }
    set({ queue: [current], order: [0], orderPos: 0 });
  },

  setError: (message) => set({ error: message }),

  restoreQueue: () => {
    // Never clobber an active session, for example a second tab that is playing.
    if (get().queue.length) return;
    const saved = loadQueue();
    if (!saved) return;
    set({
      queue: saved.queue,
      order: saved.order,
      orderPos: saved.orderPos,
      isPlaying: false,
      currentTime: 0,
      duration: 0,
    });
  },

  setFullscreen: (open) => set({ fullscreen: open }),
  // The queue and lyrics panels share the same edge of the screen, so opening
  // one closes the other rather than stacking two drawers.
  setQueueOpen: (open) => set(open ? { queueOpen: true, lyricsOpen: false } : { queueOpen: false }),
  setLyricsOpen: (open) =>
    set(open ? { lyricsOpen: true, queueOpen: false } : { lyricsOpen: false }),
}));

/**
 * Persist the queue whenever its shape changes.
 *
 * Done with a single subscription rather than a write inside every action, so
 * new queue operations cannot forget to persist. Progress ticks and volume
 * changes are ignored because they do not affect what is queued.
 */
if (typeof window !== 'undefined') {
  usePlayer.subscribe((state, previous) => {
    if (
      state.queue !== previous.queue ||
      state.order !== previous.order ||
      state.orderPos !== previous.orderPos
    ) {
      saveQueue({ queue: state.queue, order: state.order, orderPos: state.orderPos });
    }
  });
}
