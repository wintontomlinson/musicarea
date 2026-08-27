'use client';

import { usePathname } from 'next/navigation';
import { m } from 'motion/react';
import { DURATION, EASE_SMOOTH } from '@/lib/motion';

/**
 * Cross-fades page content on navigation.
 *
 * Two constraints shaped this into something smaller than it looks.
 *
 * **It animates opacity only, never a transform.** A `transform` on an element
 * makes it a containing block for `position: fixed` descendants, so any fixed
 * element inside a page would start positioning against this wrapper instead of the
 * viewport. Framer leaves a `translateY(0px)` behind once an animation settles, so
 * the hazard would outlive the animation rather than being momentary. A page-level
 * slide is not worth that class of bug; sections inside a page use `fadeUp`
 * individually, where nothing is fixed.
 *
 * **There is no exit animation.** The App Router swaps `children` for the new
 * route's tree immediately, so by the time an exit would run the outgoing content
 * is already gone. Wrapping this in `AnimatePresence` produces either a flash of
 * both routes or nothing at all depending on timing, which is why the enter-only
 * form is the one that behaves.
 *
 * The `key` is what makes it work at all: changing it on navigation remounts the
 * wrapper, which re-runs `initial`. Without it Framer sees the same element and
 * plays nothing.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <m.div
      key={pathname}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: DURATION.base, ease: EASE_SMOOTH }}
    >
      {children}
    </m.div>
  );
}
