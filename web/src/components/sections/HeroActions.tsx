'use client';

import { usePlayer } from '@/stores/player';
import { Icon } from '@/components/ui/Icon';
import type { Song } from '@/lib/types';

/** Client CTAs for the hero: Play Now toggles/starts the featured track. */
export function HeroActions({ song }: { song: Song }) {
  const currentId = usePlayer((s) => s.currentTrack()?.id);
  const isPlaying = usePlayer((s) => s.isPlaying);
  const toggle = usePlayer((s) => s.toggle);
  const playNow = usePlayer((s) => s.playNow);

  const isCurrent = currentId === song.id;
  const showPause = isCurrent && isPlaying;

  return (
    <div className="mt-6 flex flex-wrap gap-3">
      <button
        type="button"
        onClick={() => (isCurrent ? toggle() : playNow(song))}
        className="flex items-center gap-2 rounded-full bg-brand px-6 py-3 text-sm font-bold text-white shadow-glow transition-transform duration-150 hover:scale-[1.03]"
      >
        <Icon name={showPause ? 'pause' : 'play'} size={18} />
        {showPause ? 'Pause' : 'Play Now'}
      </button>
      <button
        type="button"
        className="flex items-center gap-2 rounded-full border border-subtle bg-white/5 px-6 py-3 text-sm font-bold text-white transition-colors duration-150 hover:bg-white/10"
      >
        <Icon name="plus" size={18} />
        Add to Library
      </button>
    </div>
  );
}
