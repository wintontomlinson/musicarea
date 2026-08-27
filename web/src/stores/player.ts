'use client';

import { create } from 'zustand';
import type { Song } from '@/lib/types';

export type RepeatMode = 'off' | 'all' | 'one';

interface PersistedPrefs {
  volume: number;
  muted: boolean;
  shuffle: boolean;
  repeat: RepeatMode;
}

const PREFS_KEY = 'musicarea:prefs:v1';
const DEFAULT_PREFS: PersistedPrefs = {
  volume: 0.85,
  muted: false,
  shuffle: false,
  repeat: 'off',
};

/** Volume restored when unmuting from a slider that was dragged to zero. */
const FALLBACK_UNMUTE_VOLUME = 0.5;

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
  /**
   * True when the lyrics pane is showing inside the full-screen player. Kept in
   * the store rather than as local state in the player so a keyboard shortcut can
   * open the player straight onto the lyrics.
   */
  lyricsOpen: boolean;
  /**
   * True when the listener has asked for video rather than audio-only.
   *
   * The catalogue behind this app is audio-only, so nothing currently satisfies
   * this flag; the affordance exists and reports honestly that no video is
   * available. It lives here so that wiring in a video source later is a change to
   * one component rather than to the player's state shape.
   */
  videoMode: boolean;

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
  reorderQueue: (fromQueueIndex: number, toQueueIndex: number) => void;
  addToQueue: (song: Song) => void;
  /** Insert directly after the current track, so it plays next. */
  playNext: (song: Song) => void;
  removeFromQueue: (queueIndex: number) => void;
  clearQueue: () => void;
  setFullscreen: (open: boolean) => void;
  setQueueOpen: (open: boolean) => void;
  setLyricsOpen: (open: boolean) => void;
  toggleVideoMode: () => void;
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
  currentTime: 0,
  duration: 0,
  seekSeq: 0,
  playbackError: null,
  fullscreen: false,
  queueOpen: false,
  lyricsOpen: false,
  videoMode: false,

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
    savePrefs({ volume, muted, shuffle: s.shuffle, repeat: s.repeat });
  },

  toggleMute: () => {
    const { muted: wasMuted, volume } = get();
    const muted = !wasMuted;
    // Unmuting a slider sitting at zero has to restore some level, otherwise
    // the button reports sound is on and nothing is audible.
    const nextVolume = !muted && volume === 0 ? FALLBACK_UNMUTE_VOLUME : volume;
    set({ muted, volume: nextVolume });
    const s = get();
    savePrefs({ volume: nextVolume, muted, shuffle: s.shuffle, repeat: s.repeat });
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
    savePrefs({ volume: s.volume, muted: s.muted, shuffle: nextShuffle, repeat: s.repeat });
  },

  cycleRepeat: () => {
    const modes: RepeatMode[] = ['off', 'all', 'one'];
    const repeat = modes[(modes.indexOf(get().repeat) + 1) % modes.length];
    set({ repeat });
    const s = get();
    savePrefs({ volume: s.volume, muted: s.muted, shuffle: s.shuffle, repeat });
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
  },

  /**
   * Insert a track so it plays immediately after the current one.
   *
   * Both arrays have to move together, and this is the one queue operation where
   * getting that wrong is easy to miss. Inserting into `queue` shifts the position
   * of every track after the insertion point, so every value in `order` that
   * pointed at or past that position is now pointing one track too low. The map
   * below repairs those references, and only then is the new index spliced into
   * `order` just after the playing track.
   *
   * Done in that sequence it is correct under shuffle as well as in natural order:
   * `order` is rewritten by reference rather than by position, so a shuffled
   * playback order keeps pointing at the same songs it did before.
   */
  playNext: (song) => {
    const { queue, order, orderPos } = get();
    // Nothing is playing, so "next" and "now" are the same thing.
    if (queue.length === 0 || order.length === 0) {
      get().playQueue([song], 0);
      return;
    }
    const insertAt = order[orderPos] + 1;
    const nextQueue = [...queue.slice(0, insertAt), song, ...queue.slice(insertAt)];
    const shifted = order.map((queueIndex) => (queueIndex >= insertAt ? queueIndex + 1 : queueIndex));
    set({
      queue: nextQueue,
      order: [...shifted.slice(0, orderPos + 1), insertAt, ...shifted.slice(orderPos + 1)],
    });
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
  setLyricsOpen: (open) => set({ lyricsOpen: open }),
  toggleVideoMode: () => set({ videoMode: !get().videoMode }),
}));
