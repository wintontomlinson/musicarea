'use client';

import { usePlayer } from '@/stores/player';
import { Icon } from '@/components/ui/Icon';
import type { Song } from '@/lib/types';

/**
 * Primary play action for a single track. Reflects and toggles playback when the
 * given song is already current, otherwise starts it.
 */
export function PlayPill({ song, className = '' }: { song: Song; className?: string }) {
  const currentId = usePlayer((s) => s.currentTrack()?.id);
  const isPlaying = usePlayer((s) => s.isPlaying);
  const toggle = usePlayer((s) => s.toggle);
  const playNow = usePlayer((s) => s.playNow);

  const isCurrent = currentId === song.id;
  const showPause = isCurrent && isPlaying;

  return (
    <button
      type="button"
      onClick={() => (isCurrent ? toggle() : playNow(song))}
      className={`btn-primary min-w-[112px] ${className}`}
    >
      <Icon name={showPause ? 'pause' : 'play'} size={15} />
      {showPause ? 'Pause' : 'Play'}
    </button>
  );
}
