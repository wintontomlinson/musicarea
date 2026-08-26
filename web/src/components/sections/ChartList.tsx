'use client';

import Image from 'next/image';
import Link from 'next/link';
import { memo } from 'react';
import type { Song } from '@/lib/types';
import { usePlayer } from '@/stores/player';
import {
  artistLine,
  entityHref,
  formatCount,
  formatDuration,
  pickImage,
  primaryArtist,
} from '@/lib/utils';
import { Icon } from '@/components/ui/Icon';
import { SongMenu } from '@/components/tracks/SongMenu';

/**
 * Ranked chart list. The rank is the row's anchor, set larger and in tabular
 * figures so the column stays aligned from 1 to 100.
 *
 * No movement arrows are shown: the catalogue publishes no previous position, so
 * there is no honest delta to render.
 */
export function ChartList({ songs }: { songs: Song[] }) {
  const playQueue = usePlayer((s) => s.playQueue);
  const toggle = usePlayer((s) => s.toggle);

  if (!songs.length) return null;

  return (
    <ol className="flex flex-col">
      {songs.map((song, index) => (
        <ChartRow
          key={`${song.id}-${index}`}
          song={song}
          rank={index + 1}
          onPlay={() => playQueue(songs, index)}
          onToggle={toggle}
        />
      ))}
    </ol>
  );
}

const ChartRow = memo(function ChartRow({
  song,
  rank,
  onPlay,
  onToggle,
}: {
  song: Song;
  rank: number;
  onPlay: () => void;
  onToggle: () => void;
}) {
  const isCurrent = usePlayer((s) => s.currentTrack()?.id === song.id);
  const isPlaying = usePlayer((s) => s.isPlaying && s.currentTrack()?.id === song.id);
  const artist = primaryArtist(song);

  return (
    <li
      className={`row group grid grid-cols-[28px_44px_minmax(0,1fr)_auto] items-center gap-3 px-2 py-2 sm:grid-cols-[32px_48px_minmax(0,1fr)_auto_auto_auto] ${
        isCurrent ? 'row-active' : 'row-idle'
      }`}
    >
      <span
        className={`text-right text-body font-semibold tabular-nums ${
          isCurrent ? 'text-accent' : 'text-text-muted'
        }`}
      >
        {rank}
      </span>

      <button
        type="button"
        onClick={() => (isCurrent ? onToggle() : onPlay())}
        aria-label={isPlaying ? `Pause ${song.name}` : `Play ${song.name}`}
        className="relative h-11 w-11 overflow-hidden rounded-sm bg-surface-raised"
      >
        <Image
          src={pickImage(song.image, '150x150')}
          alt=""
          fill
          sizes="44px"
          className="object-cover"
        />
        <span
          className={`absolute inset-0 grid place-items-center bg-black/55 transition-opacity duration-fast ${
            isCurrent ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          }`}
        >
          <Icon name={isPlaying ? 'pause' : 'play'} size={15} />
        </span>
      </button>

      <div className="min-w-0">
        <Link
          href={entityHref('song', song.name, song.id)}
          className={`block truncate text-body font-medium transition-colors duration-fast hover:underline ${
            isCurrent ? 'text-accent' : 'text-text'
          }`}
        >
          {song.name}
        </Link>
        <p className="mt-0.5 truncate text-meta text-text-secondary">
          {artist?.id ? (
            <Link
              href={entityHref('artist', artist.name, artist.id)}
              className="transition-colors duration-fast hover:text-text hover:underline"
            >
              {artistLine(song)}
            </Link>
          ) : (
            artistLine(song)
          )}
        </p>
      </div>

      {song.playCount ? (
        <span className="hidden text-meta tabular-nums text-text-muted sm:block">
          {formatCount(song.playCount)} plays
        </span>
      ) : (
        <span className="hidden sm:block" />
      )}

      <span className="hidden text-meta tabular-nums text-text-secondary sm:block">
        {formatDuration(song.duration)}
      </span>

      <div className="opacity-100 transition-opacity duration-fast sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100">
        <SongMenu song={song} />
      </div>
    </li>
  );
});
