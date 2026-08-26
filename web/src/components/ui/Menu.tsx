'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Icon, type IconName } from '@/components/ui/Icon';

export interface MenuItem {
  label: string;
  icon?: IconName;
  /** Navigates when set, otherwise runs onSelect. */
  href?: string;
  onSelect?: () => void;
  /** Renders in the accent colour, for destructive or emphasised actions. */
  danger?: boolean;
  /** Draws a divider above this item. */
  separated?: boolean;
}

/**
 * Accessible dropdown menu.
 *
 * Opens on click, closes on Escape, outside click or selection, and returns
 * focus to the trigger. Arrow keys move through items and the panel flips to
 * stay inside the viewport, which matters for rows near the bottom of a long
 * track list.
 */
export function Menu({
  items,
  label = 'More options',
  align = 'end',
  className = '',
  children,
}: {
  items: MenuItem[];
  label?: string;
  align?: 'start' | 'end';
  className?: string;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [dropUp, setDropUp] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const usable = items.filter(Boolean);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopPropagation();
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Decide direction before paint so the panel never visibly jumps.
  useLayoutEffect(() => {
    if (!open) return;
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const estimated = Math.min(usable.length, 8) * 38 + 16;
    setDropUp(rect.bottom + estimated > window.innerHeight - 96);
    setActiveIndex(-1);
  }, [open, usable.length]);

  useEffect(() => {
    if (open && activeIndex >= 0) {
      const nodes = panelRef.current?.querySelectorAll<HTMLElement>('[data-menu-item]');
      nodes?.[activeIndex]?.focus();
    }
  }, [open, activeIndex]);

  function onPanelKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((i) => (i + 1) % usable.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((i) => (i <= 0 ? usable.length - 1 : i - 1));
    } else if (event.key === 'Home') {
      event.preventDefault();
      setActiveIndex(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      setActiveIndex(usable.length - 1);
    } else if (event.key === 'Tab') {
      setOpen(false);
    }
  }

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen((v) => !v);
        }}
        className={open ? 'btn-icon bg-white/10 text-text' : 'btn-icon'}
      >
        {children ?? <Icon name="more" size={18} />}
      </button>

      {open && (
        <div
          ref={panelRef}
          id={menuId}
          role="menu"
          aria-label={label}
          onKeyDown={onPanelKeyDown}
          className={`surface-pop absolute z-50 min-w-[214px] animate-fade-in p-1.5 ${
            align === 'end' ? 'right-0' : 'left-0'
          } ${dropUp ? 'bottom-full mb-1.5' : 'top-full mt-1.5'}`}
        >
          {usable.map((item, index) => {
            const body = (
              <>
                {item.icon && (
                  <Icon name={item.icon} size={16} className="shrink-0 opacity-70" />
                )}
                <span className="truncate">{item.label}</span>
              </>
            );
            const shared = `flex w-full items-center gap-2.5 rounded-xs px-2.5 py-2 text-left text-body transition-colors duration-fast hover:bg-white/[0.07] focus:bg-white/[0.07] focus:outline-none ${
              item.danger ? 'text-accent' : 'text-text'
            }`;

            return (
              <div key={`${item.label}-${index}`}>
                {item.separated && <div className="my-1.5 h-px bg-white/10" />}
                {item.href ? (
                  <Link
                    data-menu-item
                    role="menuitem"
                    tabIndex={-1}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={shared}
                  >
                    {body}
                  </Link>
                ) : (
                  <button
                    data-menu-item
                    role="menuitem"
                    tabIndex={-1}
                    type="button"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      item.onSelect?.();
                      setOpen(false);
                    }}
                    className={shared}
                  >
                    {body}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
