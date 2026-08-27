/**
 * Shared motion vocabulary.
 *
 * Animation reads as designed rather than decorative when everything moves with
 * the same handful of curves, so durations and easings live here instead of being
 * typed into each component. The rule of thumb used throughout: things that
 * respond to a touch use a spring, things that appear or dismiss use a duration.
 * Springs communicate "you are dragging this"; durations communicate "the app is
 * showing you something".
 */

import type { Transition, Variants } from 'motion/react';

/**
 * The same curve as `--ease-smooth` in globals.css. Duplicated as an array
 * because Framer needs the control points as numbers and cannot read a CSS
 * variable. If one changes, change both.
 */
export const EASE_SMOOTH = [0.22, 1, 0.36, 1] as const;

/** For anything the listener is dragging or toggling. Settles without wobble. */
export const SPRING_SNAP: Transition = { type: 'spring', stiffness: 520, damping: 38, mass: 0.9 };

/** Larger surfaces (sheets, panels) where a stiffer spring reads as jumpy. */
export const SPRING_SOFT: Transition = { type: 'spring', stiffness: 300, damping: 32, mass: 1 };

export const DURATION = {
  /** Icon and colour state changes. Below ~120ms a transition stops being read. */
  fast: 0.16,
  /** The default for appearing and dismissing. */
  base: 0.28,
  /** Full-screen takeovers, which need longer to avoid feeling like a cut. */
  slow: 0.42,
} as const;

const ease = { ease: EASE_SMOOTH } as const;

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: DURATION.base, ...ease } },
  exit: { opacity: 0, transition: { duration: DURATION.fast, ...ease } },
};

/**
 * The workhorse for content arriving on a page.
 *
 * The offset is deliberately small. A large travel distance on a list of cards
 * turns a page load into a performance the listener has to sit through, and it is
 * the single most common way "animated" starts meaning "slow".
 */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: DURATION.base, ...ease } },
  exit: { opacity: 0, y: -8, transition: { duration: DURATION.fast, ...ease } },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  show: { opacity: 1, scale: 1, transition: SPRING_SNAP },
  exit: { opacity: 0, scale: 0.97, transition: { duration: DURATION.fast, ...ease } },
};

/** Full-screen player on mobile: rises from the bottom like a sheet. */
export const sheetUp: Variants = {
  hidden: { y: '100%' },
  show: { y: 0, transition: SPRING_SOFT },
  exit: { y: '100%', transition: { duration: DURATION.base, ...ease } },
};

/** Queue and lyrics panels on desktop: slide in from the right edge. */
export const panelRight: Variants = {
  hidden: { x: '100%', opacity: 0.6 },
  show: { x: 0, opacity: 1, transition: SPRING_SOFT },
  exit: { x: '100%', opacity: 0.6, transition: { duration: DURATION.base, ...ease } },
};

/**
 * Row-by-row reveal for lists and card rows.
 *
 * `staggerChildren` is small and capped by design. A 60ms stagger over a
 * twenty-card row would take more than a second to finish, so long rows use
 * `fadeUp` on the container instead of staggering every child.
 */
export const staggerContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.035, delayChildren: 0.02 } },
};

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: DURATION.base, ...ease } },
};

/**
 * Track changes in the player.
 *
 * Direction-aware: skipping forward pushes the outgoing artwork left, going back
 * pushes it right, which is the cue that tells you which way you moved through
 * the queue without reading anything.
 */
export const trackSwap = (direction: 1 | -1): Variants => ({
  hidden: { opacity: 0, x: 24 * direction, scale: 0.97 },
  show: { opacity: 1, x: 0, scale: 1, transition: { duration: DURATION.base, ...ease } },
  exit: { opacity: 0, x: -24 * direction, scale: 0.97, transition: { duration: DURATION.fast, ...ease } },
});
