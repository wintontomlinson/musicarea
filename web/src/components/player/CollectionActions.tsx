'use client';

import { usePlayer } from '@/stores/player';
import { Icon } from '@/components/ui/Icon';
import type { Song } from '@/lib/types';

/**
 * Header actions for a collection. Play starts from the top; Shuffle turns
 * shuffle on first so the generated order is random from the outset rather than
 * only after the first track. When the collection is already playing, the
 * primary action becomes pause, so the header always reflects reality.
 */
export function CollectionActions({
  songs,
  children,
}: {
  songs: Song[];
  /** Extra controls rendered after the transport, for example favourite. */
  children?: React.ReactNode;
}) {
  const playQueue = usePlayer((s) => s.playQueue);
  const toggle = usePlayer((s) => s.toggle);
  const shuffle = usePlayer((s) => s.shuffle);
  const toggleShuffle = usePlayer((s) => s.toggleShuffle);
  const isPlaying = usePlayer((s) => s.isPlaying);
  const currentId = usePlayer((s) => s.currentTrack()?.id);

  if (!songs.length) return null;

  const playingThis = !!currentId && songs.some((s) => s.id === currentId);
  const showPause = playingThis && isPlaying;

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <button
        type="button"
        onClick={() => (playingThis ? toggle() : playQueue(songs, 0))}
        className="btn-primary min-w-[112px]"
      >
        <Icon name={showPause ? 'pause' : 'play'} size={15} />
        {showPause ? 'Pause' : 'Play'}
      </button>

      <button
        type="button"
        onClick={() => {
          if (!shuffle) toggleShuffle();
          playQueue(songs, Math.floor(Math.random() * songs.length));
        }}
        className="btn-secondary"
      >
        <Icon name="shuffle" size={15} />
        Shuffle
      </button>

      {children}
    </div>
  );
}
