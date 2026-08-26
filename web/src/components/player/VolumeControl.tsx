'use client';

import { usePlayer } from '@/stores/player';
import { Icon } from '@/components/ui/Icon';

/**
 * Apple Music's volume slider: small speaker glyphs either side of a slim
 * track. Desktop only, shown in the toolbar beside the transport.
 */
export function VolumeControl() {
  const volume = usePlayer((s) => s.volume);
  const muted = usePlayer((s) => s.muted);
  const setVolume = usePlayer((s) => s.setVolume);
  const toggleMute = usePlayer((s) => s.toggleMute);

  const shown = muted ? 0 : volume;

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        aria-label={muted ? 'Unmute' : 'Mute'}
        aria-pressed={muted}
        onClick={toggleMute}
        className="text-text-secondary transition-colors hover:text-white"
      >
        <Icon name={muted || volume === 0 ? 'volumeOff' : 'volume'} size={16} />
      </button>
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(shown * 100)}
        aria-label="Volume"
        onChange={(e) => setVolume(Number(e.target.value) / 100)}
        className="h-1 w-20 cursor-pointer accent-white"
      />
    </div>
  );
}
