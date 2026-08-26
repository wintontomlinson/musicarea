'use client';

import { create } from 'zustand';
import type { Song } from '@/lib/types';
import { useHistory } from './history';

export type RepeatMode = 'off' | 'all' | 'one';

interface PersistedPrefs {
  volume: number;
  muted: boolean;
  shuffle: boolean;
  repeat: RepeatMode;
  autoplay: boolean;
}

const PREFS_KEY = 'musicarea:prefs:v1';
const DEFAULT_PREFS: PersistedPrefs = {
  volume: 0.85,
  muted: false,
  shuffle: false,
  repeat: 'off',
  // On by default. A queue that stops dead at the end of an album is the thing
  // people notice; every major player keeps going.
  autoplay: true,
};

/** Volume restored when unmuting from a slider that was dragged to zero. */
const FALLBACK_UNMUTE_VOLUME = 0.5;

/**
 * Abandoning a track before this fraction is a rejection worth recording. Past
 * it, the listener heard enough that skipping on is not a judgement, so nothing
 * is logged rather than penalising the artist for a track that was mostly played.
 */
const SKIP_RATIO = 0.25;

function loadPrefs(): PersistedPrefs {
  if (typeof window === 'undefined') return DEFAULT_PREFS;
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    return raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
}

/**
 * Persist the preference slice of the store.
 *
 * Takes the whole state and picks what it needs, rather than being handed a
 * literal at each call site. Every action that changes a preference used to
 * rebuild that object by hand, so adding one meant editing four call sites and
 * silently dropping it from any that were missed.
 */
function savePrefs(state: PersistedPrefs) {
  if (typeof window === 'undefined') return;
  const prefs: PersistedPrefs = {
    volume: state.volume,
    muted: state.muted,
    shuffle: state.shuffle,
    repeat: state.repeat,
    autoplay: state.autoplay,
  };
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* quota or unavailable */
  }
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
  /** Keep playing past the end of the queue with a taste-ranked station. */
  autoplay: boolean;
  /**
   * Last reported playback position, in seconds. This is a *report* from the
   * audio engine, never an instruction to it. Ask for a new position with
   * `seekTo`.
   */
  currentTime: number;
  duration: number;
  /**
   * Incremented on every explicit seek request. The audio engine watches this
   * counter rather than comparing `currentTime` values, which is what makes a
   * seek to 0:00 possible and lets a seek land while paused.
   */
  seekSeq: number;
  /** Set when playback gives up, e.g. no track in the queue could be streamed. */
  playbackError: string | null;

  /** True when the full-screen player is open. */
  fullscreen: boolean;
  /** True when the queue panel is open. */
  queueOpen: boolean;

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
  /** Engine to store: report where playback actually is. */
  setProgress: (currentTime: number, duration: number) => void;
  /** UI to engine: ask for a new playback position. */
  seekTo: (time: number) => void;
  setPlaybackError: (message: string | null) => void;
  toggleAutoplay: () => void;
  reorderQueue: (fromQueueIndex: number, toQueueIndex: number) => void;
  addToQueue: (song: Song) => void;
  /**
   * Append tracks the listener did not choose, such as an autoplay station.
   * Separate from `addToQueue` because that records a `queue` event, and
   * attributing machine-appended tracks to the listener would feed the taste
   * profile choices they never made.
   */
  extendQueue: (songs: Song[]) => void;
  removeFromQueue: (queueIndex: number) => void;
  clearQueue: () => void;
  setFullscreen: (open: boolean) => void;
  setQueueOpen: (open: boolean) => void;
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
  seekSeq: 0,
  playbackError: null,
  fullscreen: false,
  queueOpen: false,

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
    set({
      queue: songs,
      order,
      orderPos,
      isPlaying: true,
      currentTime: 0,
      duration: 0,
      // Starting a fresh queue clears any previous failure, and clears a stale
      // spinner left behind by a load that errored mid-flight.
      isLoading: false,
      playbackError: null,
    });
  },

  playNow: (song) => {
    // Start a one-track queue immediately.
    get().playQueue([song], 0);
  },

  toggle: () => set((s) => ({ isPlaying: !s.isPlaying })),
  setPlaying: (playing) => set({ isPlaying: playing }),
  setLoading: (loading) => set({ isLoading: loading }),

  next: (auto = false) => {
    const { order, orderPos, repeat, seekSeq } = get();
    if (!order.length) return;

    // A skip is only a skip when a person asked for it. `auto` covers a track
    // ending and the engine stepping past an unplayable one, neither of which
    // says anything about taste.
    if (!auto) {
      const { currentTime, duration } = get();
      const track = get().currentTrack();
      if (track && duration > 0 && currentTime / duration < SKIP_RATIO) {
        useHistory.getState().log(track, 'skip');
      }
    }
    if (repeat === 'one' && auto) {
      // Replay the same track. This goes through the seek counter rather than
      // just writing currentTime: a track that ended with its position already
      // at (or near) zero, such as a very short one or one that failed to
      // report progress, used to leave the player stuck with nothing playing.
      set({ currentTime: 0, seekSeq: seekSeq + 1, isPlaying: true });
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
    const { orderPos, currentTime, seekSeq } = get();
    // If more than 3s in, restart the current track (standard behavior). Routed
    // through the seek counter so it also rewinds the audio while paused,
    // instead of only moving the label and resuming from the old offset.
    if (currentTime > 3) {
      set({ currentTime: 0, seekSeq: seekSeq + 1 });
      return;
    }
    if (orderPos > 0) {
      set({ orderPos: orderPos - 1, currentTime: 0, duration: 0, isPlaying: true });
    } else {
      set({ currentTime: 0, seekSeq: seekSeq + 1 });
    }
  },

  playAt: (orderPos) => {
    const { order } = get();
    if (orderPos < 0 || orderPos >= order.length) return;
    set({ orderPos, currentTime: 0, duration: 0, isPlaying: true });
  },

  setVolume: (v) => {
    const volume = Math.max(0, Math.min(1, v));
    // Dragging the slider to zero is a mute, so the glyph agrees with the
    // silence. Previously `muted` was left alone at zero, which showed a
    // "sound on" speaker over a track no one could hear.
    const muted = volume === 0;
    set({ volume, muted });
    const s = get();
    savePrefs(s);
  },

  toggleMute: () => {
    const { muted: wasMuted, volume } = get();
    const muted = !wasMuted;
    // Unmuting a slider sitting at zero has to restore some level, otherwise
    // the button reports sound is on and nothing is audible.
    const nextVolume = !muted && volume === 0 ? FALLBACK_UNMUTE_VOLUME : volume;
    set({ muted, volume: nextVolume });
    const s = get();
    savePrefs(s);
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
    const s = get();
    savePrefs(s);
  },

  cycleRepeat: () => {
    const modes: RepeatMode[] = ['off', 'all', 'one'];
    const repeat = modes[(modes.indexOf(get().repeat) + 1) % modes.length];
    set({ repeat });
    const s = get();
    savePrefs(s);
  },

  toggleAutoplay: () => {
    set({ autoplay: !get().autoplay });
    savePrefs(get());
  },

  setProgress: (currentTime, duration) => set({ currentTime, duration }),

  seekTo: (time) => {
    const { duration, seekSeq } = get();
    // Clamp into the track. `duration` is 0 until the stream reports it, in
    // which case only a rewind to the start is meaningful.
    const target = duration > 0 ? Math.max(0, Math.min(time, duration)) : 0;
    set({ currentTime: target, seekSeq: seekSeq + 1 });
  },

  setPlaybackError: (message) => set({ playbackError: message }),

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
    // Choosing to queue something is a mild positive signal.
    useHistory.getState().log(song, 'queue');
  },

  extendQueue: (songs) => {
    const { queue, order } = get();
    const known = new Set(queue.map((s) => s.id));
    // A station is built from the same catalogue the queue came from, so it can
    // legitimately return something already lined up. Adding it twice would make
    // the queue repeat itself a few tracks later.
    const additions = songs.filter((s) => s?.id && !known.has(s.id));
    if (!additions.length) return;
    const nextQueue = [...queue, ...additions];
    const appended = additions.map((_, i) => queue.length + i);
    set({ queue: nextQueue, order: [...order, ...appended] });
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
    // If the playing track somehow fell out of the order, stay where we are
    // rather than silently jumping the listener back to the first track.
    set({
      queue: nextQueue,
      order: newOrder,
      orderPos: newOrderPos === -1 ? orderPos : newOrderPos,
    });
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

  setFullscreen: (open) => set({ fullscreen: open }),
  setQueueOpen: (open) => set({ queueOpen: open }),
}));
