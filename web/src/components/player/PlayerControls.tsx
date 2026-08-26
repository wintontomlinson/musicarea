'use client';

import { usePlayer } from '@/stores/player';
import { Icon } from '@/components/ui/Icon';

/**
 * Transport controls.
 *
 * The play control is the single filled circle in the interface. Shuffle and
 * repeat are quiet until engaged, then take the accent and expose their state
 * through aria-pressed. `size` switches between the player bar and the
 * full-screen layout.
 */
export function TransportControls({ size = 'bar' }: { size?: 'bar' | 'full' }) {
  const isPlaying = usePlayer((s) => s.isPlaying);
  const isLoading = usePlayer((s) => s.isLoading);
  const shuffle = usePlayer((s) => s.shuffle);
  const repeat = usePlayer((s) => s.repeat);
  const toggle = usePlayer((s) => s.toggle);
  const next = usePlayer((s) => s.next);
  const prev = usePlayer((s) => s.prev);
  const toggleShuffle = usePlayer((s) => s.toggleShuffle);
  const cycleRepeat = usePlayer((s) => s.cycleRepeat);
  const hasTrack = usePlayer((s) => s.queue.length > 0);

  const big = size === 'full';

  const modeClass = (on: boolean) =>
    `grid place-items-center rounded-sm transition-colors duration-fast ${
      big ? 'h-11 w-11' : 'h-8 w-8'
    } ${on ? 'text-accent' : 'text-text-secondary hover:text-text'}`;

  const stepClass = `grid place-items-center rounded-sm text-text transition-opacity duration-fast hover:opacity-70 disabled:opacity-30 ${
    big ? 'h-12 w-12' : 'h-9 w-9'
  }`;

  return (
    <div className={`flex items-center justify-center ${big ? 'gap-3 sm:gap-5' : 'gap-1.5'}`}>
      <button
        type="button"
        aria-label="Shuffle"
        aria-pressed={shuffle}
        onClick={toggleShuffle}
        className={modeClass(shuffle)}
      >
        <Icon name="shuffle" size={big ? 21 : 17} />
      </button>

      <button
        type="button"
        aria-label="Previous track"
        onClick={() => prev()}
        disabled={!hasTrack}
        className={stepClass}
      >
        <Icon name="prev" size={big ? 28 : 20} />
      </button>

      <button
        type="button"
        aria-label={isPlaying ? 'Pause' : 'Play'}
        onClick={toggle}
        disabled={!hasTrack}
        className={`btn-play-light disabled:opacity-30 ${big ? 'h-16 w-16' : 'h-10 w-10'}`}
      >
        {isLoading ? (
          <span
            className={`animate-spin rounded-full border-2 border-black/25 border-t-black ${
              big ? 'h-6 w-6' : 'h-4 w-4'
            }`}
            aria-hidden="true"
          />
        ) : (
          <Icon name={isPlaying ? 'pause' : 'play'} size={big ? 26 : 17} />
        )}
      </button>

      <button
        type="button"
        aria-label="Next track"
        onClick={() => next(false)}
        disabled={!hasTrack}
        className={stepClass}
      >
        <Icon name="next" size={big ? 28 : 20} />
      </button>

      <button
        type="button"
        aria-label={
          repeat === 'off' ? 'Repeat off' : repeat === 'all' ? 'Repeat all' : 'Repeat one'
        }
        aria-pressed={repeat !== 'off'}
        onClick={cycleRepeat}
        className={modeClass(repeat !== 'off')}
      >
        <Icon name={repeat === 'one' ? 'repeatOne' : 'repeat'} size={big ? 21 : 17} />
      </button>
    </div>
  );
}
