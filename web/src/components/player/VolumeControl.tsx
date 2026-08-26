'use client';

import { usePlayer } from '@/stores/player';
import { Icon } from '@/components/ui/Icon';

/**
 * Volume control: a mute toggle plus a slider. The glyph reflects the level so
 * the state is readable without reading the slider position.
 */
export function VolumeControl() {
  const volume = usePlayer((s) => s.volume);
  const muted = usePlayer((s) => s.muted);
  const setVolume = usePlayer((s) => s.setVolume);
  const toggleMute = usePlayer((s) => s.toggleMute);

  const level = muted ? 0 : volume;
  const glyph = level === 0 ? 'volumeOff' : level < 0.5 ? 'volumeLow' : 'volume';

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        aria-label={muted ? 'Unmute' : 'Mute'}
        aria-pressed={muted}
        onClick={toggleMute}
        className="btn-icon h-8 w-8"
      >
        <Icon name={glyph} size={17} />
      </button>
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(level * 100)}
        aria-label="Volume"
        onChange={(event) => setVolume(Number(event.target.value) / 100)}
        className="w-24"
      />
    </div>
  );
}
