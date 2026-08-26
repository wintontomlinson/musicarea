'use client';

import { useEffect, useRef } from 'react';
import { Icon } from '@/components/ui/Icon';

/**
 * Right-hand side panel used by the queue and lyrics.
 *
 * Behaves as a modal dialog: Escape closes it, the scrim closes it, background
 * scrolling is locked while it is open, focus moves into the panel and returns
 * to whatever opened it. Tab is kept inside the panel so keyboard users cannot
 * wander into the page behind the scrim.
 */
export function Drawer({
  open,
  onClose,
  title,
  headerAction,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  headerAction?: React.ReactNode;
  children: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    restoreRef.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Move focus in without stealing it from a control inside the panel.
    const focusables = () =>
      Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
    focusables()[0]?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const nodes = focusables();
      if (!nodes.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      restoreRef.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[55] animate-fade-in bg-black/60"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="fixed right-0 top-0 z-[56] flex h-full w-full max-w-[400px] animate-slide-left flex-col border-l border-subtle bg-bg-alt"
      >
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-subtle px-4">
          <h2 className="min-w-0 flex-1 truncate text-body font-semibold">{title}</h2>
          {headerAction}
          <button type="button" aria-label="Close panel" onClick={onClose} className="btn-icon">
            <Icon name="close" size={17} />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </aside>
    </>
  );
}
