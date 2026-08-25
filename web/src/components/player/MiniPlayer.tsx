'use client';

import Image from 'next/image';
import { usePlayer } from '@/stores/player';
import { artistLine, pickImage } from '@/lib/utils';
import { Icon } from '@/components/ui/Icon';

/**
 * The iOS Apple Music mini player: a translucent bar that floats directly above
 * the tab bar with artwork, title and just play/pause plus next. Tapping the
 * artwork or title opens the full-screen player.
 *
 * Mobile only. On desktop the transport, volume and now-playing LCD live in the
 * top toolbar instead, the way the Mac app arranges them.
 */
export function MiniPlayer() {
  const track = usePlayer((state) => state.currentTrack());
  const isPlaying = usePlayer((state) => state.isPlaying);
  const isLoading = usePlayer((state) => state.isLoading);
  const toggle = usePlayer((state) => state.toggle);
  const next = usePlayer((state) => state.next);
  const setFullscreen = usePlayer((state) => state.setFullscreen);
  const currentTime = usePlayer((state) => state.currentTime);
  const duration = usePlayer((state) => state.duration);

  if (!track) return null;

  const cover = pickImage(track.image, '150x150');
  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <div className="fixed inset-x-0 bottom-[calc(50px+env(safe-area-inset-bottom))] z-40 px-2 lg:hidden">
      <div className="glass-panel relative overflow-hidden rounded-xl2">
        <div className="flex items-center gap-3 p-2">
          <button
            type="button"
            onClick={() => setFullscreen(true)}
            className="flex min-w-0 flex-1 items-center gap-3 text-left"
            aria-label="Open full screen player"
          >
            <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded shadow-lift">
              <Image src={cover} alt="" fill sizes="44px" className="object-cover" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[14px] font-semibold leading-tight">
                {track.name}
              </span>
              <span className="block truncate text-[12px] leading-tight text-text-secondary">
                {artistLine(track)}
              </span>
            </span>
          </button>

          <button
            type="button"
            aria-label={isPlaying ? 'Pause' : 'Play'}
            onClick={toggle}
            className="grid h-10 w-10 shrink-0 place-items-center text-white"
          >
            {isLoading ? (
              <span
                className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
                aria-hidden="true"
              />
            ) : (
              <Icon name={isPlaying ? 'pause' : 'play'} size={24} />
            )}
          </button>

          <button
            type="button"
            aria-label="Next"
            onClick={() => next(false)}
            className="grid h-10 w-10 shrink-0 place-items-center text-white"
          >
            <Icon name="next" size={22} />
          </button>
        </div>

        {/* Hairline progress along the bottom edge, as iOS shows it. */}
        <div className="absolute inset-x-0 bottom-0 h-[2px] bg-white/10">
          <div className="h-full bg-white/60" style={{ width: `${progress}%` }} />
        </div>
      </div>
    </div>
  );
}
