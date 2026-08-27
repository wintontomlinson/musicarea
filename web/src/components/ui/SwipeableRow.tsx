'use client';

import { useSwipeGesture } from '@/hooks/useSwipeGesture';
import { Icon, type IconName } from '@/components/ui/Icon';

interface Action {
  label: string;
  icon: IconName;
  run: () => void;
}

/**
 * Wraps a list row so it can be swiped to reveal an action.
 *
 * The action hints sit *behind* the row and are uncovered as it slides, rather than sliding in
 * from the edge. That is what makes the gesture legible mid-swipe: you can see what is about to
 * happen while there is still time to abandon it by letting go short of the threshold.
 *
 * Only enabled on touch-capable widths in practice, since it costs nothing on a desktop where the
 * same actions are already visible on hover. The row still renders its children normally, so
 * nothing depends on the gesture being available.
 */
export function SwipeableRow({
  left,
  right,
  disabled = false,
  children,
}: {
  /** Revealed by swiping left, i.e. shown on the right-hand side. */
  left?: Action;
  /** Revealed by swiping right, i.e. shown on the left-hand side. */
  right?: Action;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const { offset, dragging, handlers } = useSwipeGesture({
    onSwipeLeft: left?.run,
    onSwipeRight: right?.run,
    disabled: disabled || (!left && !right),
  });

  const revealing = offset < 0 ? left : offset > 0 ? right : null;
  // Only reads as armed once the swipe is far enough to commit, so the colour change is the
  // feedback that says "let go now".
  const armed = Math.abs(offset) >= 72;

  return (
    <div className="relative overflow-hidden rounded-card">
      {revealing && (
        <div
          aria-hidden="true"
          className={`absolute inset-y-0 flex items-center gap-2 px-4 text-[12px] font-bold transition-colors ${
            offset < 0 ? 'right-0 justify-end' : 'left-0 justify-start'
          } ${armed ? 'text-accent' : 'text-text-muted'}`}
        >
          <Icon name={revealing.icon} size={18} />
          {revealing.label}
        </div>
      )}

      <div
        {...handlers}
        style={{ transform: `translateX(${offset}px)` }}
        // `pan-y` is load-bearing: it permits the browser to keep scrolling vertically while the
        // horizontal axis is watched. Without it the list would either not scroll or the swipe
        // would never fire, depending on the browser.
        className={`relative touch-pan-y bg-bg ${dragging ? '' : 'transition-transform duration-200 ease-smooth'}`}
      >
        {children}
      </div>
    </div>
  );
}
