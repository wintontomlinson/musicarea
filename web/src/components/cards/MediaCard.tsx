'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { CollectionCard, Song } from '@/lib/types';
import { Icon } from '@/components/ui/Icon';
import { artistLine, entityHref, isSong, pickImage } from '@/lib/utils';
import { usePlayer } from '@/stores/player';
import { SongMenu } from '@/components/tracks/SongMenu';

/**
 * Shelf card for a song, album or playlist.
 *
 * The artwork carries the card: no container box, no shadow stack. Hover reveals
 * a single play affordance and lifts the artwork very slightly. Songs play in
 * the context of their shelf so pressing play continues into the rest of the
 * row rather than stopping after one track.
 */
export function MediaCard({
  item,
  context,
  shape = 'square',
}: {
  item: Song | CollectionCard;
  /** Sibling songs, used as the play queue when this card is a song. */
  context?: Song[];
  shape?: 'square' | 'circle';
}) {
  const playQueue = usePlayer((s) => s.playQueue);
  const playNow = usePlayer((s) => s.playNow);
  const toggle = usePlayer((s) => s.toggle);
  const currentId = usePlayer((s) => s.currentTrack()?.id);
  const isPlaying = usePlayer((s) => s.isPlaying);

  const song = isSong(item);
  const cover = pickImage(item.image);
  const href = hrefFor(item);
  const subtitle = song ? artistLine(item) : subtitleFor(item);
  const isCurrent = song && currentId === item.id;
  const showPause = isCurrent && isPlaying;

  function onPlay(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (!song) return;
    if (isCurrent) {
      toggle();
      return;
    }
    if (context?.length) {
      const start = Math.max(
        0,
        context.findIndex((s) => s.id === item.id),
      );
      playQueue(context, start);
    } else {
      playNow(item);
    }
  }

  const artwork = (
    <div
      className={`relative overflow-hidden bg-surface-raised shadow-art ${
        shape === 'circle' ? 'rounded-full' : 'rounded'
      }`}
    >
      <Image
        src={cover}
        alt=""
        fill
        sizes="(max-width: 640px) 45vw, (max-width: 1024px) 25vw, 200px"
        className="object-cover transition-transform duration-base ease-out group-hover:scale-[1.03]"
      />

      {song && (
        <button
          type="button"
          onClick={onPlay}
          aria-label={showPause ? `Pause ${item.name}` : `Play ${item.name}`}
          className={`btn-play-light absolute bottom-2.5 right-2.5 h-10 w-10 transition-all duration-base ease-out focus-visible:translate-y-0 focus-visible:opacity-100 ${
            isCurrent
              ? 'translate-y-0 opacity-100'
              : 'translate-y-1.5 opacity-0 group-hover:translate-y-0 group-hover:opacity-100'
          }`}
        >
          <Icon name={showPause ? 'pause' : 'play'} size={16} />
        </button>
      )}
    </div>
  );

  return (
    <div className="group relative">
      {href ? (
        <Link href={href} className="block" aria-label={item.name}>
          <div className="aspect-square">{artwork}</div>
        </Link>
      ) : (
        <div className="aspect-square">{artwork}</div>
      )}

      <div className={`mt-3 flex items-start gap-1 ${shape === 'circle' ? 'justify-center' : ''}`}>
        <div className={`min-w-0 flex-1 ${shape === 'circle' ? 'text-center' : ''}`}>
          {href ? (
            <Link
              href={href}
              className={`block truncate text-body font-semibold transition-colors duration-fast hover:underline ${
                isCurrent ? 'text-accent' : 'text-text'
              }`}
            >
              {item.name}
            </Link>
          ) : (
            <p className="truncate text-body font-semibold">{item.name}</p>
          )}
          {subtitle && <p className="mt-1 truncate text-meta text-text-secondary">{subtitle}</p>}
        </div>

        {song && (
          <div className="opacity-0 transition-opacity duration-fast group-hover:opacity-100 focus-within:opacity-100">
            <SongMenu song={item} />
          </div>
        )}
      </div>
    </div>
  );
}

function subtitleFor(item: CollectionCard): string {
  // Browse rows sometimes report "0 songs" for collections whose track list has
  // not been expanded upstream. That is noise, so fall through to the year.
  const provided = item.subtitle && !/^0\s+songs?$/i.test(item.subtitle.trim()) ? item.subtitle : '';
  if (provided) return provided;
  if (item.type === 'album') return item.year ? `Album · ${item.year}` : 'Album';
  return item.songCount ? `Playlist · ${item.songCount} songs` : 'Playlist';
}

function hrefFor(item: Song | CollectionCard): string | null {
  if (isSong(item)) return entityHref('song', item.name, item.id);
  if (item.type === 'album') return entityHref('album', item.name, item.id);
  if (item.type === 'playlist') return entityHref('playlist', item.name, item.id);
  return null;
}
