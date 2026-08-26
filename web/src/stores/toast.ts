'use client';

import { create } from 'zustand';

export interface Toast {
  id: number;
  message: string;
  /** Optional inline action, for example Undo or View. */
  action?: { label: string; run: () => void };
}

interface ToastState {
  toasts: Toast[];
  notify: (message: string, action?: Toast['action']) => void;
  dismiss: (id: number) => void;
}

let nextId = 1;
const LIFETIME = 3600;

/**
 * Transient confirmation messages. Deliberately tiny: feedback for actions that
 * would otherwise be silent, such as adding a track to the queue.
 */
export const useToast = create<ToastState>((set, get) => ({
  toasts: [],

  notify: (message, action) => {
    const id = nextId++;
    // Cap the stack so rapid actions cannot bury the interface.
    set((state) => ({ toasts: [...state.toasts, { id, message, action }].slice(-3) }));
    if (typeof window !== 'undefined') {
      window.setTimeout(() => get().dismiss(id), LIFETIME);
    }
  },

  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

/** Imperative helper for non-React call sites. */
export function notify(message: string, action?: Toast['action']) {
  useToast.getState().notify(message, action);
}
