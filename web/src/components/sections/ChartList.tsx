'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { Song } from '@/lib/types';
import { usePlayer } from '@/stores/player';
import { artistLine, entityHref, formatCount, formatDuration, pickImage, primaryArtist } from '@/lib/utils';
import { Icon } from '@/components/ui/Icon';

/**
 * A ranked chart list in Apple Music's row style: a large rank number, artwork
 * that reveals a play glyph on hover, then title and artist. No movement
 * indicator is shown because the catalogue exposes no historical position, so
 * there is no honest delta to render.
 */
export function ChartList({ songs }: { songs: Song[] }) {
  const currentId = usePlayer((s) => s.currentTrack()?.id);
  const isPlaying = usePlayer((s) => s.isPlaying);
  const toggle = usePlayer((s) => s.toggle);
  const playQueue = usePlayer((s) => s.playQueue);

  if (!songs.length) return null;

  return (
    <div className="flex flex-col">
      {songs.map((song, i) => {
        const isCurrent = currentId === song.id;
        const artist = primaryArtist(song);
        return (
          <div
            key={`${song.id}-${i}`}
            className={`group grid grid-cols-[28px_44px_1fr_auto] items-center gap-3 rounded-xl border border-transparent px-2 py-2.5 transition-colors sm:grid-cols-[34px_48px_1fr_auto_auto] ${
              isCurrent ? 'border-fuchsia-300/20 bg-fuchsia-400/[0.09]' : 'hover:bg-white/[0.06]'
            }`}
          >
            {/* Rank */}
            <span
              className={`text-right text-[15px] font-semibold tabular-nums ${
                isCurrent ? 'text-accent' : 'text-text-secondary'
              }`}
            >
              {i + 1}
            </span>

            {/* Artwork doubles as the play control */}
            <button
              type="button"
              aria-label={isCurrent && isPlaying ? `Pause ${song.name}` : `Play ${song.name}`}
              onClick={() => (isCurrent ? toggle() : playQueue(songs, i))}
              className="relative h-11 w-11 overflow-hidden rounded-xl border border-white/10 shadow-lift"
            >
              <Image
                src={pickImage(song.image, '150x150')}
                alt=""
                fill
                sizes="44px"
                className="object-cover"
              />
              <span className="absolute inset-0 grid place-items-center bg-black/45 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                <Icon name={isCurrent && isPlaying ? 'pause' : 'play'} size={16} className="text-white" />
              </span>
            </button>

            {/* Title + artist */}
            <div className="min-w-0">
              <p
                className={`truncate text-[14px] font-medium leading-tight ${
                  isCurrent ? 'text-accent' : ''
                }`}
              >
                {song.name}
              </p>
              <p className="mt-0.5 truncate text-[13px] leading-tight text-text-secondary">
                {artist?.id ? (
                  <Link
                    href={entityHref('artist', artist.name, artist.id)}
                    className="hover:text-white"
                  >
                    {artistLine(song)}
                  </Link>
                ) : (
                  artistLine(song)
                )}
              </p>
            </div>

            {/* Plays (desktop) */}
            <span className="hidden text-[13px] tabular-nums text-text-secondary sm:block">
              {song.playCount ? `${formatCount(song.playCount)} plays` : ''}
            </span>

            {/* Duration */}
            <span className="text-[13px] tabular-nums text-text-secondary">
              {formatDuration(song.duration)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
