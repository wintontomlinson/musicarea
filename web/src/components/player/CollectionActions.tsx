'use client';

import { usePlayer } from '@/stores/player';
import { Icon } from '@/components/ui/Icon';
import type { Song } from '@/lib/types';

/**
 * Apple Music's pair of tinted header pills: Play starts the collection from the
 * top, Shuffle turns shuffle on first so the queue is randomised from the start.
 */
export function CollectionActions({ songs }: { songs: Song[] }) {
  const playQueue = usePlayer((s) => s.playQueue);
  const shuffle = usePlayer((s) => s.shuffle);
  const toggleShuffle = usePlayer((s) => s.toggleShuffle);

  if (!songs.length) return null;

  function playAll() {
    playQueue(songs, 0);
  }

  function shuffleAll() {
    if (!shuffle) toggleShuffle();
    // Start from a random track; the store's shuffle order randomises the rest.
    const start = Math.floor(Math.random() * songs.length);
    playQueue(songs, start);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" onClick={playAll} className="button-primary min-w-[7rem]">
        <Icon name="play" size={15} />
        Play
      </button>
      <button type="button" onClick={shuffleAll} className="button-primary min-w-[7rem]">
        <Icon name="shuffle" size={15} />
        Shuffle
      </button>
    </div>
  );
}
