'use client';

import { useCallback, useState } from 'react';

/**
 * Reports when an element first scrolls into view, then stops watching.
 *
 * Used to defer expensive work until it is about to be seen. The mixes endpoint is the
 * motivating case: each mix runs its own recall pass upstream and a cold response can
 * take seconds, so firing it on page load would spend the listener's first moments on a
 * section below the fold.
 *
 * Built on a **ref callback rather than an effect**. That is not a style choice. An
 * effect that sets state synchronously causes a cascading render, which React 19 lints
 * against, and the unsupported-browser branch here has to resolve immediately rather
 * than a tick later. A ref callback runs at the moment the node is attached, has the
 * node in hand without a separate ref object, and can return its own cleanup, so the
 * observer's whole lifecycle sits in one function.
 *
 * One-shot by design. A section that dropped its data on scrolling away and re-fetched
 * on return would turn one slow request into a repeated slow request.
 */
export function useInView<T extends Element = HTMLDivElement>({
  rootMargin = '200px',
}: { rootMargin?: string } = {}) {
  const [inView, setInView] = useState(false);

  const ref = useCallback(
    (node: T | null) => {
      if (!node || inView) return;

      // No IntersectionObserver means no way to know when this is visible. Reporting
      // "visible" is the safe answer: the content loads, which is the point, and the
      // only thing lost is the deferral.
      if (typeof IntersectionObserver === 'undefined') {
        setInView(true);
        return;
      }

      const observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            setInView(true);
            observer.disconnect();
          }
        },
        // Fires before the section reaches the viewport, so a fast scroll finds content
        // rather than a skeleton.
        { rootMargin },
      );
      observer.observe(node);
      return () => observer.disconnect();
    },
    [inView, rootMargin],
  );

  return { ref, inView };
}
