'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { AnimatePresence, m } from 'motion/react';
import { DURATION, EASE_SMOOTH, panelRight, sheetUp } from '@/lib/motion';

/* -------------------------------------------------------------------------- */
/* Shared modal bookkeeping                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Scroll locking is reference counted.
 *
 * The queue panel opens *on top of* the Now Playing takeover, so two sheets are
 * routinely open at once. Each previously saved and restored `body.overflow`
 * independently, which meant whichever closed first restored scrolling while the
 * other was still open, and the page underneath began scrolling behind a modal.
 * Counting means the lock lifts when the last sheet closes, not the first.
 */
let lockCount = 0;
let restoreOverflow = '';

function lockScroll() {
  if (lockCount === 0) {
    restoreOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  lockCount += 1;
}

function unlockScroll() {
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0) document.body.style.overflow = restoreOverflow;
}

/**
 * A stack of the sheets currently open, innermost last.
 *
 * Escape used to be handled by every sheet listening on `window`, which closed all
 * of them at once. The queue panel worked around that by calling
 * `stopPropagation`, which is fragile: it depends on which element happened to be
 * focused when the key was pressed. Consulting a stack instead means Escape always
 * dismisses exactly the topmost sheet, which is what a listener expects, and one
 * press never closes two layers.
 */
const stack: string[] = [];

/* -------------------------------------------------------------------------- */

type Placement = 'takeover' | 'right';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  /** Accessible name for the dialog. */
  label: string;
  /**
   * `takeover` fills the viewport and is dismissed by dragging down (the Now
   * Playing screen). `right` is an edge panel dismissed by dragging right (the
   * queue).
   */
  placement?: Placement;
  /** Dimmed, clickable backdrop. Off by default for takeovers, which are opaque. */
  scrim?: boolean;
  /** Applied to the scrolling surface. */
  className?: string;
  /** Rendered behind the surface, inside the sheet, and not affected by the drag. */
  backdrop?: React.ReactNode;
  /** Tailwind z-index class. Sheets stack, so callers own the ordering. */
  zClassName?: string;
  children: React.ReactNode;
}

/**
 * A dismissible overlay surface: full-screen takeover or edge panel.
 *
 * The drag-to-dismiss logic is lifted from the original full-screen player, where
 * it was tuned against real thumbs, and is worth reading before changing:
 *
 * - The gesture only starts when the surface is already scrolled to the top,
 *   otherwise dragging down inside a scrollable panel would dismiss it instead of
 *   scrolling it.
 * - There is a `decided` phase. Until the finger has travelled a few pixels the
 *   gesture has not committed, so a vertical flick that begins as a scroll is not
 *   stolen and turned into a dismiss.
 * - Dismissal is distance *or* velocity. A long slow drag past the threshold
 *   commits, and so does a short fast flick, which is how a sheet feels physical
 *   rather than like a button with extra steps.
 *
 * Enter and exit are handled by Framer variants on an outer element while the drag
 * writes inline transforms to an inner one. Keeping them on separate nodes avoids
 * the two systems fighting over the same `transform`.
 */
export function Sheet({
  open,
  onClose,
  label,
  placement = 'takeover',
  scrim = placement === 'right',
  className = '',
  backdrop,
  zClassName = 'z-50',
  children,
}: SheetProps) {
  const id = useId();
  const surfaceRef = useRef<HTMLDivElement>(null);
  const drag = useRef({ start: 0, delta: 0, active: false, decided: false, startedAt: 0 });
  const [settling, setSettling] = useState(false);
  const axis = placement === 'takeover' ? 'y' : 'x';

  useEffect(() => {
    if (!open) return;
    lockScroll();
    stack.push(id);
    const onKey = (event: KeyboardEvent) => {
      // Only the topmost sheet reacts, so Escape peels one layer at a time.
      if (event.key === 'Escape' && stack[stack.length - 1] === id) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      const at = stack.lastIndexOf(id);
      if (at !== -1) stack.splice(at, 1);
      unlockScroll();
    };
  }, [open, id, onClose]);

  const apply = useCallback(
    (delta: number) => {
      const surface = surfaceRef.current;
      if (!surface) return;
      if (delta <= 0) {
        surface.style.transform = '';
        surface.style.opacity = '';
        return;
      }
      surface.style.transform = axis === 'y' ? `translateY(${delta}px)` : `translateX(${delta}px)`;
      // Fades out as it travels, but never below 0.4: a surface that has gone
      // fully transparent before the gesture commits looks like it broke.
      surface.style.opacity = String(Math.max(0.4, 1 - delta / 900));
    },
    [axis],
  );

  function onTouchStart(event: React.TouchEvent) {
    if (event.touches.length !== 1) return;
    if ((surfaceRef.current?.scrollTop ?? 0) > 0) return;
    const touch = event.touches[0];
    drag.current = {
      start: axis === 'y' ? touch.clientY : touch.clientX,
      delta: 0,
      active: true,
      decided: false,
      startedAt: Date.now(),
    };
    setSettling(false);
  }

  function onTouchMove(event: React.TouchEvent) {
    const state = drag.current;
    if (!state.active) return;
    const touch = event.touches[0];
    const raw = (axis === 'y' ? touch.clientY : touch.clientX) - state.start;
    if (!state.decided) {
      if (raw < 6) return;
      if ((surfaceRef.current?.scrollTop ?? 0) > 0) {
        state.active = false;
        return;
      }
      state.decided = true;
    }
    state.delta = Math.max(0, raw);
    apply(state.delta);
  }

  function onTouchEnd() {
    const state = drag.current;
    if (!state.active) return;
    state.active = false;
    if (!state.decided) return;
    const velocity = state.delta / (Date.now() - state.startedAt || 1);
    setSettling(true);
    if (state.delta > 120 || (velocity > 0.6 && state.delta > 60)) onClose();
    else apply(0);
  }

  const variants = placement === 'takeover' ? sheetUp : panelRight;

  return (
    <AnimatePresence>
      {open && (
        <m.div
          key="sheet"
          role="dialog"
          aria-modal="true"
          aria-label={label}
          className={`fixed inset-0 ${zClassName} ${placement === 'right' ? 'pointer-events-none' : 'overflow-hidden bg-scrim'}`}
          initial="hidden"
          animate="show"
          exit="exit"
          variants={placement === 'right' ? undefined : variants}
        >
          {backdrop}
          {scrim && (
            <m.button
              type="button"
              // Decorative dismiss target. The dialog already has a labelled close
              // control, so exposing this to a screen reader would just add a
              // second unnamed button to tab through.
              aria-hidden="true"
              tabIndex={-1}
              onClick={onClose}
              className="pointer-events-auto absolute inset-0 h-full w-full cursor-default bg-black/[0.55]"
              variants={{
                hidden: { opacity: 0 },
                show: { opacity: 1, transition: { duration: DURATION.base, ease: EASE_SMOOTH } },
                exit: { opacity: 0, transition: { duration: DURATION.fast, ease: EASE_SMOOTH } },
              }}
              initial="hidden"
              animate="show"
              exit="exit"
            />
          )}
          <m.div
            className={placement === 'right' ? 'pointer-events-auto absolute inset-y-0 right-0 flex' : 'relative h-full'}
            variants={placement === 'right' ? variants : undefined}
            initial={placement === 'right' ? 'hidden' : undefined}
            animate={placement === 'right' ? 'show' : undefined}
            exit={placement === 'right' ? 'exit' : undefined}
          >
            <div
              ref={surfaceRef}
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
              onTouchCancel={onTouchEnd}
              className={`${className} ${settling ? 'transition-[transform,opacity] duration-300 ease-smooth' : ''}`}
            >
              {children}
            </div>
          </m.div>
        </m.div>
      )}
    </AnimatePresence>
  );
}
