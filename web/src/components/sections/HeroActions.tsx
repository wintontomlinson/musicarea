'use client';

import { usePlayer } from '@/stores/player';
import { Icon } from '@/components/ui/Icon';
import type { Song } from '@/lib/types';

export function HeroActions({ song }: { song: Song }) {
  const currentId = usePlayer((s) => s.currentTrack()?.id);
  const isPlaying = usePlayer((s) => s.isPlaying);
  const toggle = usePlayer((s) => s.toggle);
  const playNow = usePlayer((s) => s.playNow);

  const isCurrent = currentId === song.id;
  const showPause = isCurrent && isPlaying;

  return (
    <div className="mt-5">
      <button
        type="button"
        onClick={() => (isCurrent ? toggle() : playNow(song))}
        className="button-primary"
      >
        <Icon name={showPause ? 'pause' : 'play'} size={17} />
        {showPause ? 'Pause' : 'Play'}
      </button>
    </div>
  );
}
