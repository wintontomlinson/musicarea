'use client';

import { usePlayer } from '@/stores/player';
import { Icon } from '@/components/ui/Icon';

/**
 * Surfaces a playback failure. Previously an unplayable queue skipped silently
 * from track to track and then simply stopped, which read as the app breaking
 * for no reason. Sits above the mobile mini player so it cannot be covered.
 */
export function PlaybackAlert() {
  const message = usePlayer((s) => s.playbackError);
  const setPlaybackError = usePlayer((s) => s.setPlaybackError);

  if (!message) return null;

  return (
    <div
      role="alert"
      className="fixed inset-x-0 bottom-[calc(120px+env(safe-area-inset-bottom))] z-[60] mx-auto flex w-[min(28rem,calc(100%-1.5rem))] items-start gap-3 rounded-xl border border-amber-300/30 bg-[#2a1a0d]/95 p-3 shadow-lift backdrop-blur-xl lg:bottom-6"
    >
      <span className="mt-0.5 shrink-0 text-amber-300">
        <Icon name="disc" size={18} />
      </span>
      <p className="min-w-0 flex-1 text-[13px] leading-snug text-amber-50">{message}</p>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => setPlaybackError(null)}
        className="shrink-0 rounded-md text-amber-200/70 transition-colors hover:text-white"
      >
        <Icon name="close" size={16} />
      </button>
    </div>
  );
}
