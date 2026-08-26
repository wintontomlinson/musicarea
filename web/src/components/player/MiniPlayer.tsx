'use client';

import Image from 'next/image';
import { usePlayer } from '@/stores/player';
import { artistLine, pickImage } from '@/lib/utils';
import { Icon } from '@/components/ui/Icon';

/**
 * Mobile mini player. Sits directly above the tab bar and opens the full Now
 * Playing screen when the artwork or title is tapped. Only play/pause and next
 * are exposed here: everything else belongs to the full screen.
 *
 * Hidden entirely when nothing is queued, so the tab bar keeps the full width.
 */
export function MiniPlayer() {
  const track = usePlayer((s) => s.currentTrack());
  const isPlaying = usePlayer((s) => s.isPlaying);
  const isLoading = usePlayer((s) => s.isLoading);
  const toggle = usePlayer((s) => s.toggle);
  const next = usePlayer((s) => s.next);
  const setFullscreen = usePlayer((s) => s.setFullscreen);
  const currentTime = usePlayer((s) => s.currentTime);
  const duration = usePlayer((s) => s.duration);

  if (!track) return null;

  const cover = pickImage(track.image, '150x150');
  const pct = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <div className="fixed inset-x-0 bottom-[calc(var(--tabbar-h)+env(safe-area-inset-bottom))] z-40 px-2 pb-2 lg:hidden">
      <div className="relative overflow-hidden rounded-md border border-subtle bg-surface-raised">
        <div className="flex items-center gap-2 p-2">
          <button
            type="button"
            onClick={() => setFullscreen(true)}
            aria-label={`Open player for ${track.name}`}
            className="flex min-w-0 flex-1 items-center gap-3 text-left"
          >
            <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-sm bg-surface">
              <Image src={cover} alt="" fill sizes="44px" className="object-cover" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-meta font-semibold leading-tight">
                {track.name}
              </span>
              <span className="mt-0.5 block truncate text-micro leading-tight text-text-secondary">
                {artistLine(track)}
              </span>
            </span>
          </button>

          <button
            type="button"
            aria-label={isPlaying ? 'Pause' : 'Play'}
            onClick={toggle}
            className="btn-play-light h-11 w-11"
          >
            {isLoading ? (
              <span
                className="h-4 w-4 animate-spin rounded-full border-2 border-black/25 border-t-black"
                aria-hidden="true"
              />
            ) : (
              <Icon name={isPlaying ? 'pause' : 'play'} size={17} />
            )}
          </button>

          <button
            type="button"
            aria-label="Next track"
            onClick={() => next(false)}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-text"
          >
            <Icon name="next" size={20} />
          </button>
        </div>

        <div className="absolute inset-x-0 bottom-0 h-[2px] bg-white/10">
          <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
}
