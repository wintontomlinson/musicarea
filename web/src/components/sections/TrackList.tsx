'use client';

import Image from 'next/image';
import Link from 'next/link';
import { memo } from 'react';
import type { Song } from '@/lib/types';
import { usePlayer } from '@/stores/player';
import { artistLine, entityHref, formatDuration, pickImage, primaryArtist } from '@/lib/utils';
import { Icon } from '@/components/ui/Icon';
import { SongMenu } from '@/components/tracks/SongMenu';
import { FavoriteButton } from '@/components/library/FavoriteButton';

interface TrackListProps {
  songs: Song[];
  /** Cover thumbnail per row. Albums hide it, mixed lists show it. */
  showArt?: boolean;
  /** Album column on desktop. Hidden on album pages, where it is redundant. */
  showAlbum?: boolean;
  /** Leading position number. Hidden for queue-like lists. */
  showIndex?: boolean;
  /** Enables a removal action in each row's menu. */
  onRemove?: (song: Song, index: number) => void;
  removeLabel?: string;
}

/**
 * Track table.
 *
 * Rows are separated by space and a hover wash rather than borders or cards, so
 * a fifty track album stays readable. The leading number becomes a play control
 * on hover or focus, and the playing row is marked with accent text plus a small
 * level meter. Album and duration columns fold away below the small breakpoint.
 *
 * Each row plays the whole list from its own position, so playback continues
 * through the collection instead of stopping after one track.
 */
export function TrackList({
  songs,
  showArt = true,
  showAlbum = true,
  showIndex = true,
  onRemove,
  removeLabel,
}: TrackListProps) {
  const playQueue = usePlayer((s) => s.playQueue);
  const toggle = usePlayer((s) => s.toggle);

  if (!songs.length) return null;

  return (
    <div className="flex flex-col">
      {songs.map((song, index) => (
        <TrackRow
          key={`${song.id}-${index}`}
          song={song}
          index={index}
          showArt={showArt}
          showAlbum={showAlbum}
          showIndex={showIndex}
          onPlay={() => playQueue(songs, index)}
          onToggle={toggle}
          onRemove={onRemove ? () => onRemove(song, index) : undefined}
          removeLabel={removeLabel}
        />
      ))}
    </div>
  );
}

/**
 * Grid tracks per row variant, declared per breakpoint.
 *
 * The album and metadata cells are removed from the layout below the small
 * breakpoint, so a single shared column list would leave their space behind as
 * an empty gap. These are written out in full rather than composed at runtime
 * because Tailwind only generates classes it can see in the source.
 */
const COLUMNS: Record<string, string> = {
  'true-true-true':
    'grid-cols-[28px_44px_minmax(0,1fr)_auto] sm:grid-cols-[28px_44px_minmax(0,1fr)_minmax(0,0.8fr)_auto_auto]',
  'true-true-false':
    'grid-cols-[28px_44px_minmax(0,1fr)_auto] sm:grid-cols-[28px_44px_minmax(0,1fr)_auto_auto]',
  'true-false-true':
    'grid-cols-[28px_minmax(0,1fr)_auto] sm:grid-cols-[28px_minmax(0,1fr)_minmax(0,0.8fr)_auto_auto]',
  'true-false-false':
    'grid-cols-[28px_minmax(0,1fr)_auto] sm:grid-cols-[28px_minmax(0,1fr)_auto_auto]',
  'false-true-true':
    'grid-cols-[44px_minmax(0,1fr)_auto] sm:grid-cols-[44px_minmax(0,1fr)_minmax(0,0.8fr)_auto_auto]',
  'false-true-false':
    'grid-cols-[44px_minmax(0,1fr)_auto] sm:grid-cols-[44px_minmax(0,1fr)_auto_auto]',
};

interface TrackRowProps {
  song: Song;
  index: number;
  showArt: boolean;
  showAlbum: boolean;
  showIndex: boolean;
  onPlay: () => void;
  onToggle: () => void;
  onRemove?: () => void;
  removeLabel?: string;
}

/**
 * A single row. Memoised and subscribed narrowly to the player so that a
 * progress tick does not re-render an entire album's worth of rows: only the row
 * whose current/playing flags actually changed does any work.
 */
const TrackRow = memo(function TrackRow({
  song,
  index,
  showArt,
  showAlbum,
  showIndex,
  onPlay,
  onToggle,
  onRemove,
  removeLabel,
}: TrackRowProps) {
  const isCurrent = usePlayer((s) => s.currentTrack()?.id === song.id);
  const isPlaying = usePlayer((s) => s.isPlaying && s.currentTrack()?.id === song.id);
  const artist = primaryArtist(song);

  const columns = COLUMNS[`${showIndex}-${showArt}-${showAlbum}`] ?? COLUMNS['true-true-true'];

  return (
    <div
      className={`row group grid items-center gap-3 px-2 py-2 ${columns} ${
        isCurrent ? 'row-active' : 'row-idle'
      }`}
    >
      {showIndex && (
        <button
          type="button"
          onClick={() => (isCurrent ? onToggle() : onPlay())}
          aria-label={isPlaying ? `Pause ${song.name}` : `Play ${song.name}`}
          className="grid h-7 w-7 place-items-center rounded-xs text-meta text-text-muted transition-colors duration-fast hover:text-text"
        >
          {isCurrent ? (
            isPlaying ? (
              <LevelMeter />
            ) : (
              <Icon name="play" size={13} className="text-accent" />
            )
          ) : (
            <>
              <span className="tabular-nums group-hover:hidden">{index + 1}</span>
              <Icon name="play" size={13} className="hidden text-text group-hover:block" />
            </>
          )}
        </button>
      )}

      {showArt && (
        <button
          type="button"
          onClick={() => (isCurrent ? onToggle() : onPlay())}
          aria-label={isPlaying ? `Pause ${song.name}` : `Play ${song.name}`}
          className="relative h-11 w-11 shrink-0 overflow-hidden rounded-sm bg-surface-raised"
        >
          <Image
            src={pickImage(song.image, '150x150')}
            alt=""
            fill
            sizes="44px"
            className="object-cover"
          />
          {!showIndex && (
            <span className="absolute inset-0 grid place-items-center bg-black/50 opacity-0 transition-opacity duration-fast group-hover:opacity-100">
              <Icon name={isPlaying ? 'pause' : 'play'} size={15} />
            </span>
          )}
        </button>
      )}

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
          {song.explicitContent && (
            <span
              aria-label="Explicit"
              title="Explicit"
              className="mr-1.5 inline-grid h-[13px] w-[13px] translate-y-[1px] place-items-center rounded-[2px] bg-white/20 text-[9px] font-bold leading-none text-text"
            >
              E
            </span>
          )}
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

      {showAlbum && (
        <div className="hidden min-w-0 sm:block">
          {song.album?.id && song.album.name ? (
            <Link
              href={entityHref('album', song.album.name, song.album.id)}
              className="block truncate text-meta text-text-secondary transition-colors duration-fast hover:text-text hover:underline"
            >
              {song.album.name}
            </Link>
          ) : (
            <span className="block truncate text-meta text-text-muted">{song.album?.name}</span>
          )}
        </div>
      )}

      <div className="hidden items-center gap-1 sm:flex">
        <span className="opacity-0 transition-opacity duration-fast group-hover:opacity-100 focus-within:opacity-100">
          <FavoriteButton song={song} size={16} />
        </span>
        <span className="w-10 text-right text-meta tabular-nums text-text-secondary">
          {formatDuration(song.duration)}
        </span>
      </div>

      <div className="opacity-100 transition-opacity duration-fast sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100">
        <SongMenu song={song} onRemove={onRemove} removeLabel={removeLabel} />
      </div>
    </div>
  );
});

/** Four bars that animate while this row is the one playing. */
function LevelMeter() {
  return (
    <span className="flex h-3.5 items-end gap-[2px]" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          className="w-[2px] rounded-full bg-accent"
          style={{ height: '100%', animation: `eq 900ms ease-in-out ${-i * 130}ms infinite` }}
        />
      ))}
    </span>
  );
}
