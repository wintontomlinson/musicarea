'use client';

import { usePlayer } from '@/stores/player';
import { Icon } from '@/components/ui/Icon';
import type { Song } from '@/lib/types';

/**
 * Play-all and shuffle controls for a collection header (album, playlist,
 * artist). Play starts the list from the top; Shuffle enables shuffle first so
 * the queue is randomized from the start.
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
    // Start from a random track; the store's shuffle order will randomize the rest.
    const start = Math.floor(Math.random() * songs.length);
    playQueue(songs, start);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={playAll}
        className="flex items-center gap-2 rounded-full bg-brand px-6 py-3 text-sm font-bold text-white shadow-glow transition-transform duration-150 hover:scale-[1.03]"
      >
        <Icon name="play" size={18} />
        Play
      </button>
      <button
        type="button"
        onClick={shuffleAll}
        className="flex items-center gap-2 rounded-full border border-subtle bg-white/5 px-5 py-3 text-sm font-bold text-white transition-colors duration-150 hover:bg-white/10"
      >
        <Icon name="shuffle" size={18} />
        Shuffle
      </button>
    </div>
  );
}
