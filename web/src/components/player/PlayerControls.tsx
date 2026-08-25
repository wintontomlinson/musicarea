'use client';

import { usePlayer } from '@/stores/player';
import { Icon } from '@/components/ui/Icon';

/** Shared transport controls, sized via the `size` prop for mini vs full. */
export function TransportControls({ size = 'mini' }: { size?: 'mini' | 'full' }) {
  const isPlaying = usePlayer((s) => s.isPlaying);
  const isLoading = usePlayer((s) => s.isLoading);
  const shuffle = usePlayer((s) => s.shuffle);
  const repeat = usePlayer((s) => s.repeat);
  const toggle = usePlayer((s) => s.toggle);
  const next = usePlayer((s) => s.next);
  const prev = usePlayer((s) => s.prev);
  const toggleShuffle = usePlayer((s) => s.toggleShuffle);
  const cycleRepeat = usePlayer((s) => s.cycleRepeat);

  const big = size === 'full';
  const playSize = big ? 'h-16 w-16' : 'h-10 w-10';

  return (
    <div className={`flex items-center justify-center ${big ? 'gap-5' : 'gap-2'}`}>
      <button
        type="button"
        aria-label="Shuffle"
        aria-pressed={shuffle}
        onClick={toggleShuffle}
        className={`grid place-items-center rounded-full transition-colors duration-150 ${
          shuffle ? 'text-accent' : 'text-text-secondary hover:text-white'
        } ${big ? 'h-10 w-10' : 'h-8 w-8'}`}
      >
        <Icon name="shuffle" size={big ? 22 : 18} />
      </button>

      <button
        type="button"
        aria-label="Previous"
        onClick={() => prev()}
        className={`grid place-items-center rounded-full text-white transition-transform duration-150 hover:scale-110 ${
          big ? 'h-12 w-12' : 'h-9 w-9'
        }`}
      >
        <Icon name="prev" size={big ? 28 : 22} />
      </button>

      <button
        type="button"
        aria-label={isPlaying ? 'Pause' : 'Play'}
        onClick={toggle}
        className={`grid place-items-center rounded-full bg-accent text-white shadow-lift transition-transform duration-150 hover:scale-105 ${playSize}`}
      >
        {isLoading ? (
          <span
            className="h-5 w-5 animate-spin rounded-full border-2 border-black/30 border-t-black"
            aria-hidden="true"
          />
        ) : (
          <Icon name={isPlaying ? 'pause' : 'play'} size={big ? 30 : 20} />
        )}
      </button>

      <button
        type="button"
        aria-label="Next"
        onClick={() => next(false)}
        className={`grid place-items-center rounded-full text-white transition-transform duration-150 hover:scale-110 ${
          big ? 'h-12 w-12' : 'h-9 w-9'
        }`}
      >
        <Icon name="next" size={big ? 28 : 22} />
      </button>

      <button
        type="button"
        aria-label={`Repeat ${repeat}`}
        aria-pressed={repeat !== 'off'}
        onClick={cycleRepeat}
        className={`relative grid place-items-center rounded-full transition-colors duration-150 ${
          repeat !== 'off' ? 'text-accent' : 'text-text-secondary hover:text-white'
        } ${big ? 'h-10 w-10' : 'h-8 w-8'}`}
      >
        <Icon name={repeat === 'one' ? 'repeatOne' : 'repeat'} size={big ? 22 : 18} />
      </button>
    </div>
  );
}
