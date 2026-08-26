'use client';

import { usePlayer } from '@/stores/player';
import { Icon } from '@/components/ui/Icon';

/**
 * Transport controls in Apple Music's style: plain white glyphs rather than a
 * filled play circle, with shuffle and repeat turning red when engaged. `size`
 * switches between the compact toolbar set and the large full-player set.
 */
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
  const modeSize = big ? 20 : 15;
  const stepSize = big ? 30 : 20;
  const playSize = big ? 40 : 24;

  const modeClass = (on: boolean) =>
    `grid place-items-center rounded-md transition-colors ${
      on ? 'text-accent' : 'text-text-secondary hover:text-white'
    } ${big ? 'h-10 w-10' : 'h-7 w-7'}`;

  const stepClass = `grid place-items-center rounded-md text-white transition-opacity hover:opacity-70 ${
    big ? 'h-12 w-12' : 'h-8 w-8'
  }`;

  return (
    <div className={`flex items-center justify-center ${big ? 'gap-4' : 'gap-1'}`}>
      <button
        type="button"
        aria-label="Shuffle"
        aria-pressed={shuffle}
        onClick={toggleShuffle}
        className={modeClass(shuffle)}
      >
        <Icon name="shuffle" size={modeSize} />
      </button>

      <button type="button" aria-label="Previous" onClick={() => prev()} className={stepClass}>
        <Icon name="prev" size={stepSize} />
      </button>

      <button
        type="button"
        aria-label={isPlaying ? 'Pause' : 'Play'}
        onClick={toggle}
        className={`grid place-items-center rounded-full bg-white text-black transition hover:bg-white/90 active:scale-95 ${
          big ? 'h-16 w-16' : 'h-9 w-9'
        }`}
      >
        {isLoading ? (
          <span
            className={`animate-spin rounded-full border-2 border-white/30 border-t-white ${
              big ? 'h-7 w-7' : 'h-4 w-4'
            }`}
            aria-hidden="true"
          />
        ) : (
          <Icon name={isPlaying ? 'pause' : 'play'} size={playSize} />
        )}
      </button>

      <button type="button" aria-label="Next" onClick={() => next(false)} className={stepClass}>
        <Icon name="next" size={stepSize} />
      </button>

      <button
        type="button"
        aria-label={`Repeat ${repeat}`}
        aria-pressed={repeat !== 'off'}
        onClick={cycleRepeat}
        className={modeClass(repeat !== 'off')}
      >
        <Icon name={repeat === 'one' ? 'repeatOne' : 'repeat'} size={modeSize} />
      </button>
    </div>
  );
}
