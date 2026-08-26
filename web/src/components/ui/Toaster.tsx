'use client';

import { useToast } from '@/stores/toast';

/**
 * Toast host. Sits above the player on desktop and above the tab bar on mobile
 * so confirmations never cover the transport. Announced politely rather than
 * assertively: these messages confirm, they do not warn.
 */
export function Toaster() {
  const toasts = useToast((s) => s.toasts);
  const dismiss = useToast((s) => s.dismiss);

  if (!toasts.length) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--tabbar-h)+68px+env(safe-area-inset-bottom))] z-[70] flex flex-col items-center gap-2 px-4 lg:bottom-[calc(var(--player-h)+16px)] lg:items-start lg:px-6"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="surface-pop pointer-events-auto flex animate-rise items-center gap-3 py-2.5 pl-4 pr-2.5 text-body"
        >
          <span className="text-text">{toast.message}</span>
          {toast.action && (
            <button
              type="button"
              onClick={() => {
                toast.action?.run();
                dismiss(toast.id);
              }}
              className="rounded-xs px-2 py-1 text-meta font-semibold text-accent transition-colors hover:bg-white/5"
            >
              {toast.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
