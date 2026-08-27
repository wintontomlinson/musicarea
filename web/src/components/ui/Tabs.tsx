'use client';

import { useId, useRef } from 'react';
import { m } from 'motion/react';
import { SPRING_SNAP } from '@/lib/motion';

export interface TabItem<T extends string> {
  id: T;
  label: string;
  /** Shown after the label, for counts such as "Songs 24". */
  badge?: string | number;
}

interface TabsProps<T extends string> {
  items: ReadonlyArray<TabItem<T>>;
  value: T;
  onChange: (id: T) => void;
  /** Accessible name for the tab strip. */
  label: string;
  /** `pill` fills the active tab, `underline` draws a rule beneath it. */
  variant?: 'pill' | 'underline';
  className?: string;
}

/**
 * Tab strip with an indicator that travels between tabs.
 *
 * The indicator is a single element shared across tabs via `layoutId`, so Framer
 * animates it from the old position to the new one. Rendering an indicator inside
 * each tab and fading them would land in roughly the same place visually, but the
 * movement is the part that makes the strip feel connected rather than like a row
 * of independent buttons.
 *
 * Keyboard support follows the ARIA tabs pattern rather than relying on Tab order:
 * only the selected tab is in the tab sequence, and arrow keys move between them.
 * That is the behaviour assistive technology announces for a tablist, and it means
 * a nine-tab strip costs one Tab press to skip rather than nine.
 */
export function Tabs<T extends string>({
  items,
  value,
  onChange,
  label,
  variant = 'underline',
  className = '',
}: TabsProps<T>) {
  const layoutId = useId();
  const stripRef = useRef<HTMLDivElement>(null);

  function onKeyDown(event: React.KeyboardEvent) {
    const offset = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (!offset) return;
    event.preventDefault();
    const index = items.findIndex((item) => item.id === value);
    // Wraps, which the ARIA pattern recommends: reaching the end and stopping
    // dead reads as an unresponsive control.
    const nextIndex = (index + offset + items.length) % items.length;
    const next = items[nextIndex];
    onChange(next.id);
    // Focus has to follow selection or the arrow keys stop working after the
    // first press, since the previously selected tab has left the tab sequence.
    stripRef.current?.querySelector<HTMLButtonElement>(`[data-tab="${next.id}"]`)?.focus();
  }

  return (
    <div
      ref={stripRef}
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={`no-scrollbar flex gap-1 overflow-x-auto ${
        variant === 'pill' ? 'rounded-pill border border-white/10 bg-black/25 p-1' : 'border-b border-subtle'
      } ${className}`}
    >
      {items.map((item) => {
        const selected = item.id === value;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            data-tab={item.id}
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(item.id)}
            className={`relative shrink-0 whitespace-nowrap px-4 font-semibold transition-colors ${
              variant === 'pill' ? 'rounded-pill py-1.5 text-[13px]' : 'pb-3 pt-2 text-[14px]'
            } ${selected ? 'text-white' : 'text-text-secondary hover:text-white'}`}
          >
            {selected && (
              <m.span
                layoutId={layoutId}
                transition={SPRING_SNAP}
                // Behind the label, and non-interactive: the button above owns the
                // hit area, and an indicator that intercepted clicks would swallow
                // taps near the middle of the tab.
                className={`absolute inset-0 -z-10 ${
                  variant === 'pill' ? 'rounded-pill bg-brand shadow-glow' : 'rounded-t-sm'
                }`}
              >
                {variant === 'underline' && (
                  <span className="absolute inset-x-0 bottom-0 h-[2.5px] rounded-full bg-accent" />
                )}
              </m.span>
            )}
            <span className={selected && variant === 'pill' ? 'relative text-on-accent' : 'relative'}>
              {item.label}
              {item.badge !== undefined && (
                <span className="ml-1.5 text-[11px] font-bold text-text-muted">{item.badge}</span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
