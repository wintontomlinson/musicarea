'use client';

import { useEffect, useRef } from 'react';
import { Icon } from '@/components/ui/Icon';

/**
 * Centred dialog for short tasks: creating a playlist, renaming, confirming a
 * delete. Traps Tab, closes on Escape and on a scrim click, locks background
 * scroll, and returns focus to the trigger when it unmounts.
 *
 * On small screens it sits at the bottom of the viewport, which is easier to
 * reach one-handed than a vertically centred sheet.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    restoreRef.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusables = () =>
      Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input, textarea, select, [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );

    // Prefer the first text field, which is what the task usually starts with.
    const fields = focusables();
    (fields.find((node) => node.tagName === 'INPUT' || node.tagName === 'TEXTAREA') ?? fields[0])?.focus();

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
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-0 sm:items-center sm:p-6">
      <div
        className="absolute inset-0 animate-fade-in bg-black/65"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative w-full max-w-md animate-sheet-up rounded-t-xl border border-subtle bg-[#141414] pb-[env(safe-area-inset-bottom)] sm:animate-rise sm:rounded-xl"
      >
        <header className="flex items-start gap-3 px-5 pt-5">
          <div className="min-w-0 flex-1">
            <h2 className="text-section">{title}</h2>
            {description && <p className="mt-1.5 text-meta text-text-secondary">{description}</p>}
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className="btn-icon -mr-1.5 -mt-1">
            <Icon name="close" size={17} />
          </button>
        </header>

        {children && <div className="px-5 pt-5">{children}</div>}

        {footer && <div className="flex justify-end gap-2.5 px-5 pb-5 pt-6">{footer}</div>}
      </div>
    </div>
  );
}
