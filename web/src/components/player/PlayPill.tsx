'use client';

import { usePlayer } from '@/stores/player';
import { Icon } from '@/components/ui/Icon';
import type { Song } from '@/lib/types';

/**
 * Apple's tinted Play pill for a single track, used by the Listen Now featured
 * card and the song page. Reflects and toggles playback when the given song is
 * already the current track, otherwise starts it.
 */
export function PlayPill({ song }: { song: Song }) {
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
      className="button-primary min-w-[7rem]"
    >
      <Icon name={showPause ? 'pause' : 'play'} size={15} />
      {showPause ? 'Pause' : 'Play'}
    </button>
  );
}
