'use client';

import { create } from 'zustand';
import type { Song } from '@/lib/types';

interface UiState {
  /** Songs awaiting a playlist choice, or null when the dialog is closed. */
  addToPlaylist: Song[] | null;
  openAddToPlaylist: (songs: Song[]) => void;
  closeAddToPlaylist: () => void;
}

/**
 * Small amount of cross-cutting interface state. Kept out of the player and
 * library stores because it describes what is on screen, not what is playing or
 * what is saved.
 */
export const useUi = create<UiState>((set) => ({
  addToPlaylist: null,
  openAddToPlaylist: (songs) => set({ addToPlaylist: songs.length ? songs : null }),
  closeAddToPlaylist: () => set({ addToPlaylist: null }),
}));
