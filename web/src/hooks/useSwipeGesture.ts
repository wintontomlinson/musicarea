'use client';

import { useCallback, useRef, useState } from 'react';

/**
 * Horizontal swipe on a row, without breaking vertical scrolling.
 *
 * The hard part of a swipeable list row is not detecting the swipe, it is *not* detecting one when
 * the listener meant to scroll. A row that grabs every touch turns a list into a minefield. So the
 * gesture has three phases:
 *
 * 1. **Undecided.** A finger is down but has not moved far enough to mean anything.
 * 2. **Decided.** Once it has moved past a few pixels, the dominant axis wins outright. Vertical
 *    means this is a scroll and the row bows out for the rest of the gesture; horizontal means the
 *    row takes it and captures the pointer so leaving the row does not abort mid-swipe.
 * 3. **Settled.** Past the distance threshold the action fires; short of it the row springs back.
 *
 * Pointer events rather than touch events, so the same code covers a trackpad drag and a stylus.
 * `touch-action: pan-y` (applied by the caller through the returned class) is what tells the
 * browser it may still scroll vertically while we watch the horizontal axis.
 */

/** Movement before the axis is decided. Small enough to feel immediate, large enough that a
 *  slightly angled scroll is not read as a swipe. */
const DECIDE_AFTER_PX = 8;

/** How far a swipe must travel to commit. */
const COMMIT_PX = 72;

/** The row never follows the finger the whole way; it lags, which signals a limit. */
const MAX_OFFSET_PX = 96;

interface Options {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  /** Disables the gesture entirely, for rows where it makes no sense. */
  disabled?: boolean;
}

export function useSwipeGesture({ onSwipeLeft, onSwipeRight, disabled = false }: Options) {
  const [offset, setOffset] = useState(0);
  const state = useRef({ startX: 0, startY: 0, axis: '' as '' | 'x' | 'y', active: false });
  /** Set when a swipe committed, so the click it would otherwise produce is suppressed. */
  const swipedRef = useRef(false);

  const reset = useCallback(() => {
    state.current.active = false;
    state.current.axis = '';
    setOffset(0);
  }, []);

  const onPointerDown = useCallback(
    (event: React.PointerEvent) => {
      if (disabled) return;
      // Ignore secondary buttons and multi-touch, both of which mean something else.
      if (event.button !== 0) return;
      state.current = { startX: event.clientX, startY: event.clientY, axis: '', active: true };
      swipedRef.current = false;
    },
    [disabled],
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent) => {
      const current = state.current;
      if (!current.active) return;

      const dx = event.clientX - current.startX;
      const dy = event.clientY - current.startY;

      if (!current.axis) {
        if (Math.abs(dx) < DECIDE_AFTER_PX && Math.abs(dy) < DECIDE_AFTER_PX) return;
        // Whichever axis moved more wins. A vertical decision ends our involvement for the rest of
        // this gesture, which is what lets the list scroll normally.
        current.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
        if (current.axis === 'y') {
          current.active = false;
          return;
        }
        // Capture only once the gesture is ours, so a vertical scroll is never intercepted.
        try {
          (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
        } catch {
          /* capture is best-effort; the gesture still works without it */
        }
      }

      if (current.axis !== 'x') return;
      // Damped past the commit point, so the row visibly resists rather than sliding away.
      const damped =
        Math.sign(dx) * Math.min(Math.abs(dx), COMMIT_PX + (Math.abs(dx) - COMMIT_PX) * 0.35);
      setOffset(Math.sign(damped) * Math.min(Math.abs(damped), MAX_OFFSET_PX));
    },
    [],
  );

  const onPointerUp = useCallback(
    (event: React.PointerEvent) => {
      const current = state.current;
      if (!current.active || current.axis !== 'x') {
        reset();
        return;
      }
      const dx = event.clientX - current.startX;
      if (dx <= -COMMIT_PX && onSwipeLeft) {
        swipedRef.current = true;
        onSwipeLeft();
      } else if (dx >= COMMIT_PX && onSwipeRight) {
        swipedRef.current = true;
        onSwipeRight();
      }
      reset();
    },
    [onSwipeLeft, onSwipeRight, reset],
  );

  const onClickCapture = useCallback((event: React.MouseEvent) => {
    // A committed swipe ends with a pointerup that the browser also reports as a click. Without
    // this, swiping a row to queue it would additionally start playing it.
    if (swipedRef.current) {
      event.preventDefault();
      event.stopPropagation();
      swipedRef.current = false;
    }
  }, []);

  return {
    offset,
    /** True while the row is being dragged, so the caller can drop its CSS transition. */
    dragging: offset !== 0,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: reset,
      onClickCapture,
    },
  };
}
