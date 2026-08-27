'use client';

import { usePlayer } from '@/stores/player';
import { Icon } from '@/components/ui/Icon';

/**
 * Mute toggle plus a slider. Desktop only; on mobile the hardware keys own volume
 * and a software slider would be redundant.
 *
 * Kept as a native `<input type="range">` rather than being rebuilt like `SeekBar`
 * was. The seek rail needed custom rendering for its fill, hover preview and
 * per-second keyboard stepping; volume needs none of that, and the native control
 * brings correct keyboard and screen-reader behaviour for free. `accent-color` via
 * the `range-accent` class is enough to make it match the palette.
 */
export function VolumeControl() {
  const volume = usePlayer((s) => s.volume);
  const muted = usePlayer((s) => s.muted);
  const setVolume = usePlayer((s) => s.setVolume);
  const toggleMute = usePlayer((s) => s.toggleMute);

  // Muting is shown as zero rather than remembering the level, so the slider agrees
  // with what is audible. The stored level is restored on unmute by the store.
  const shown = muted ? 0 : volume;

  return (
    <div className="hidden items-center gap-1.5 xl:flex">
      <button
        type="button"
        aria-label={muted ? 'Unmute' : 'Mute'}
        aria-pressed={muted}
        onClick={toggleMute}
        className="grid h-9 w-9 place-items-center rounded-full text-text-secondary transition hover:bg-white/10 hover:text-white"
      >
        <Icon name={muted || volume === 0 ? 'volumeOff' : 'volume'} size={17} />
      </button>
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(shown * 100)}
        aria-label="Volume"
        onChange={(e) => setVolume(Number(e.target.value) / 100)}
        className="range-accent h-1 w-20 cursor-pointer"
      />
    </div>
  );
}
