'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { Song } from '@/lib/types';
import { usePlayer } from '@/stores/player';
import { artistLine, entityHref, formatCount, formatDuration, pickImage, primaryArtist } from '@/lib/utils';
import { Icon } from '@/components/ui/Icon';

/**
 * A ranked chart list. Rank is shown prominently. The rank-change indicator is
 * rendered but neutral: the catalogue exposes no historical position, so there
 * is no honest delta to show. Play counts stand in as the ranking signal.
 */
export function ChartList({ songs }: { songs: Song[] }) {
  const currentId = usePlayer((s) => s.currentTrack()?.id);
  const isPlaying = usePlayer((s) => s.isPlaying);
  const toggle = usePlayer((s) => s.toggle);
  const playQueue = usePlayer((s) => s.playQueue);

  if (!songs.length) return null;

  return (
    <div className="surface-card flex flex-col overflow-hidden p-1 shadow-lift">
      {songs.map((song, i) => {
        const isCurrent = currentId === song.id;
        const artist = primaryArtist(song);
        return (
          <div
            key={`${song.id}-${i}`}
            className={`group grid grid-cols-[40px_44px_1fr_auto] items-center gap-3 rounded-lg px-2 py-2.5 sm:grid-cols-[48px_48px_1fr_auto_auto] ${
              isCurrent ? 'bg-accent/10' : 'hover:bg-white/5'
            }`}
          >
            {/* Rank + neutral indicator */}
            <div className="flex flex-col items-center">
              <span className={`text-lg font-extrabold tabular-nums ${i < 3 ? 'text-accent' : 'text-text-secondary'}`}>
                {i + 1}
              </span>
              <span className="text-[10px] text-text-muted" aria-label="No change data">
                &bull;
              </span>
            </div>

            {/* Play / art */}
            <button
              type="button"
              aria-label={isCurrent && isPlaying ? `Pause ${song.name}` : `Play ${song.name}`}
              onClick={() => (isCurrent ? toggle() : playQueue(songs, i))}
              className="relative h-11 w-11 overflow-hidden rounded"
            >
              <Image src={pickImage(song.image, '150x150')} alt="" fill sizes="44px" className="object-cover" />
              <span className="absolute inset-0 grid place-items-center bg-black/40 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                <Icon name={isCurrent && isPlaying ? 'pause' : 'play'} size={18} className="text-white" />
              </span>
            </button>

            {/* Title + artist */}
            <div className="min-w-0">
              <p className={`truncate text-sm font-semibold ${isCurrent ? 'text-accent' : ''}`}>{song.name}</p>
              <p className="truncate text-xs text-text-secondary">
                {artist?.id ? (
                  <Link href={entityHref('artist', artist.name, artist.id)} className="hover:text-white hover:underline">
                    {artistLine(song)}
                  </Link>
                ) : (
                  artistLine(song)
                )}
              </p>
            </div>

            {/* Plays (desktop) */}
            <span className="hidden text-xs tabular-nums text-text-secondary sm:block">
              {song.playCount ? `${formatCount(song.playCount)} plays` : ''}
            </span>

            {/* Duration */}
            <span className="text-xs tabular-nums text-text-secondary">
              {formatDuration(song.duration)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
