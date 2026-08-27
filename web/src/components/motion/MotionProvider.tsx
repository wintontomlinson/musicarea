'use client';

import { LazyMotion, MotionConfig, domMax } from 'motion/react';

/**
 * Wraps the app in Framer Motion's feature set.
 *
 * Three decisions here are worth keeping.
 *
 * `strict` forbids the `motion.*` components and requires `m.*`. That is the
 * point of using `LazyMotion` at all: `motion.div` statically pulls in the whole
 * feature set wherever it is imported, which would defeat this provider. Strict
 * mode turns "someone used the wrong component" from a silent bundle regression
 * into an error in development.
 *
 * The features are imported *synchronously* rather than through the async form the
 * docs show. Async loading is tempting on a media-heavy app, but it opens a window
 * where a component renders with its `initial` styles applied and no animation
 * engine present to move it off them, which shows up as content stuck at
 * `opacity: 0` until the chunk lands. A flash of invisible content is a worse
 * trade than the bundle cost, especially since this provider only mounts inside
 * the app shell.
 *
 * `domMax` rather than `domAnimation` because the redesign needs layout animations
 * (the shared tab indicator uses `layoutId`) and drag, neither of which is in the
 * smaller bundle.
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    // `reducedMotion="user"` defers to the OS setting, which means every animation
    // written against this provider honours `prefers-reduced-motion` without each
    // component having to check. It reduces transforms and keeps opacity changes,
    // so interfaces stay comprehensible rather than becoming instant jump-cuts.
    <MotionConfig reducedMotion="user">
      <LazyMotion features={domMax} strict>
        {children}
      </LazyMotion>
    </MotionConfig>
  );
}
