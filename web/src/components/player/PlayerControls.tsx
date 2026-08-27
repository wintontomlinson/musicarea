'use client';

import { m } from 'motion/react';
import { usePlayer } from '@/stores/player';
import { Icon } from '@/components/ui/Icon';
import { SPRING_SNAP } from '@/lib/motion';

type Size = 'mini' | 'bar' | 'full';

/**
 * Per-size metrics.
 *
 * Kept as a table rather than as nested ternaries in the markup. With three sizes
 * and five controls the inline form had reached the point where changing one number
 * meant reading every line to find which of them it applied to.
 *
 * `mini` is for tight spaces such as a card overlay, `bar` for the persistent player
 * bar, `full` for the immersive player where the transport is the main event.
 */
const METRICS: Record<Size, {
  mode: number; step: number; play: number; modeBox: string; stepBox: string; playBox: string; gap: string; spinner: string;
}> = {
  mini: { mode: 15, step: 18, play: 18, modeBox: 'h-7 w-7', stepBox: 'h-8 w-8', playBox: 'h-9 w-9', gap: 'gap-1', spinner: 'h-4 w-4' },
  bar: { mode: 16, step: 21, play: 20, modeBox: 'h-8 w-8', stepBox: 'h-9 w-9', playBox: 'h-10 w-10', gap: 'gap-1.5', spinner: 'h-4 w-4' },
  full: { mode: 20, step: 30, play: 34, modeBox: 'h-11 w-11', stepBox: 'h-12 w-12', playBox: 'h-16 w-16', gap: 'gap-3 sm:gap-4', spinner: 'h-7 w-7' },
};

/**
 * Shuffle, previous, play/pause, next, repeat.
 *
 * The play button is the only filled control, which is what makes it findable
 * without reading the icons. Shuffle and repeat tint to the accent when engaged and
 * carry `aria-pressed`, so their state is available without relying on colour alone,
 * and repeat swaps to a numbered glyph on its third state rather than trying to
 * convey "one" through tint.
 */
export function TransportControls({
  size = 'bar',
  className = '',
}: {
  size?: Size;
  className?: string;
}) {
  const isPlaying = usePlayer((s) => s.isPlaying);
  const isLoading = usePlayer((s) => s.isLoading);
  const shuffle = usePlayer((s) => s.shuffle);
  const repeat = usePlayer((s) => s.repeat);
  const hasTrack = usePlayer((s) => s.currentTrack() !== null);
  const toggle = usePlayer((s) => s.toggle);
  const next = usePlayer((s) => s.next);
  const prev = usePlayer((s) => s.prev);
  const toggleShuffle = usePlayer((s) => s.toggleShuffle);
  const cycleRepeat = usePlayer((s) => s.cycleRepeat);

  const metric = METRICS[size];

  const modeClass = (on: boolean) =>
    `relative grid place-items-center rounded-full transition-colors ${metric.modeBox} ${
      on ? 'text-accent' : 'text-text-secondary hover:text-white'
    }`;

  const stepClass = `grid place-items-center rounded-full text-white transition disabled:opacity-30 disabled:hover:bg-transparent hover:bg-white/10 ${metric.stepBox}`;

  return (
    <div className={`flex items-center justify-center ${metric.gap} ${className}`}>
      <button
        type="button"
        aria-label="Shuffle"
        aria-pressed={shuffle}
        onClick={toggleShuffle}
        className={modeClass(shuffle)}
      >
        <Icon name="shuffle" size={metric.mode} />
        {/* A dot under an engaged toggle, the way Spotify marks them. Redundant with
            the tint on purpose: tint alone fails for anyone who cannot separate the
            accent from the secondary text colour. */}
        {shuffle && <span className="absolute bottom-0.5 h-[3px] w-[3px] rounded-full bg-accent" />}
      </button>

      <button
        type="button"
        aria-label="Previous"
        onClick={() => prev()}
        disabled={!hasTrack}
        className={stepClass}
      >
        <Icon name="prev" size={metric.step} />
      </button>

      <m.button
        type="button"
        aria-label={isPlaying ? 'Pause' : 'Play'}
        onClick={toggle}
        disabled={!hasTrack}
        whileHover={hasTrack ? { scale: 1.06 } : undefined}
        whileTap={hasTrack ? { scale: 0.94 } : undefined}
        transition={SPRING_SNAP}
        className={`grid place-items-center rounded-full bg-brand text-on-accent shadow-glow disabled:opacity-40 ${metric.playBox}`}
      >
        {isLoading ? (
          <span
            className={`animate-spin rounded-full border-2 border-on-accent/30 border-t-on-accent ${metric.spinner}`}
            aria-hidden="true"
          />
        ) : (
          <Icon name={isPlaying ? 'pause' : 'play'} size={metric.play} />
        )}
      </m.button>

      <button
        type="button"
        aria-label="Next"
        onClick={() => next(false)}
        disabled={!hasTrack}
        className={stepClass}
      >
        <Icon name="next" size={metric.step} />
      </button>

      <button
        type="button"
        aria-label={`Repeat ${repeat}`}
        aria-pressed={repeat !== 'off'}
        onClick={cycleRepeat}
        className={modeClass(repeat !== 'off')}
      >
        <Icon name={repeat === 'one' ? 'repeatOne' : 'repeat'} size={metric.mode} />
        {repeat !== 'off' && (
          <span className="absolute bottom-0.5 h-[3px] w-[3px] rounded-full bg-accent" />
        )}
      </button>
    </div>
  );
}
