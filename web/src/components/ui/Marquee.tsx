'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/** Pixels per second. Slow enough to read, fast enough to finish a long title. */
const SPEED = 34;

/** Below this overflow it is not worth moving; the ellipsis is less distracting. */
const MIN_OVERFLOW = 8;

interface MarqueeProps {
  /** Plain text. Element children would break the width measurement. */
  text: string;
  className?: string;
  /** Pauses the scroll. The player passes `false` while paused, so a parked track
   *  is not permanently animating in the corner of the screen. */
  active?: boolean;
}

/**
 * Scrolls text horizontally, but only when it actually overflows.
 *
 * Two details matter more than they look.
 *
 * The element is measured rather than the string length being guessed at, because
 * "Ishq Wala Love" and "IIIIIIIIIIIIII" are the same length and nowhere near the
 * same width. `scrollWidth` against `clientWidth` is the only honest test, and it
 * has to be re-run on resize since the same title overflows on a phone and fits on
 * a desktop.
 *
 * The animation duration is derived from the overflow distance instead of being
 * fixed, which keeps the speed constant. With a fixed duration a title that
 * overflows by 20px would creep and one that overflows by 400px would race.
 */
export function Marquee({ text, className = '', active = true }: MarqueeProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState(0);

  const measure = useCallback(() => {
    const node = viewportRef.current;
    if (!node) return;
    const amount = node.scrollWidth - node.clientWidth;
    setOverflow(amount > MIN_OVERFLOW ? amount : 0);
  }, []);

  useEffect(() => {
    measure();
    const node = viewportRef.current;
    if (!node || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
    // `text` is a dependency because a new title needs re-measuring even when the
    // element's own box has not changed size, which a ResizeObserver would not see.
  }, [measure, text]);

  const scrolling = overflow > 0 && active;

  return (
    <div ref={viewportRef} className={`relative overflow-hidden ${className}`}>
      <span
        // `block w-max` lets the span take its natural width so `scrollWidth`
        // exceeds the viewport. Without `w-max` it would be constrained to the
        // parent and there would be nothing to measure.
        className={`block w-max ${scrolling ? 'animate-marquee' : 'max-w-full truncate'}`}
        style={
          scrolling
            ? ({
                '--marquee-shift': `-${overflow}px`,
                // The keyframes hold at each end for 12% of the cycle, so the
                // travel itself is 76% of the duration. Adding the pauses back in
                // keeps the moving part at SPEED.
                '--marquee-duration': `${(overflow / SPEED / 0.76).toFixed(2)}s`,
              } as React.CSSProperties)
            : undefined
        }
      >
        {text}
      </span>
    </div>
  );
}
