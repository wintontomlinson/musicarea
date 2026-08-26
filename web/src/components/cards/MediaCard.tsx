import Image from 'next/image';
import Link from 'next/link';
import type { CollectionCard, Song } from '@/lib/types';
import { artistLine, entityHref, isSong, pickImage } from '@/lib/utils';
import { PlayButton } from '@/components/player/PlayButton';

/**
 * Artwork tile for a song, album or playlist inside a shelf.
 *
 * Only songs get a play control. An album or playlist card cannot start
 * playback, because its track list has not been fetched at this point; both used
 * to render a matching play circle on hover anyway, which was decorative
 * (`aria-hidden`, no handler) and clicking it simply followed the card's link.
 * Those now go to the detail page, where the header's Play button works on the
 * real track list.
 */
export function MediaCard({ item, context }: { item: Song | CollectionCard; context?: Song[] }) {
  const cover = pickImage(item.image);
  const song = isSong(item);
  const subtitle = song ? artistLine(item) : subtitleFor(item);
  const href = hrefFor(item);

  const inner = (
    <>
      <div className="relative aspect-square overflow-hidden rounded-card border border-white/10 bg-surface-raised shadow-lift transition duration-300 group-hover:-translate-y-1 group-hover:border-fuchsia-200/45 group-hover:shadow-glow">
        <Image
          src={cover}
          alt={item.name}
          fill
          sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 200px"
          className="object-cover transition duration-500 group-hover:scale-105"
        />
        {song && (
          <>
            {/* Darkens the lower corner so the play button reads against pale
                artwork, so it appears only where that button does. */}
            <span
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            />
            <PlayButton
              song={item}
              list={context}
              size={15}
              className="absolute bottom-2.5 left-2.5 h-10 w-10 translate-y-2 opacity-0 transition duration-300 focus:translate-y-0 focus:opacity-100 group-hover:translate-y-0 group-hover:opacity-100"
            />
          </>
        )}
      </div>

      <div className="mt-2.5">
        <p className="truncate text-[14px] font-bold leading-tight text-white">{item.name}</p>
        {subtitle && (
          <p className="mt-1 truncate text-[12px] leading-tight text-text-secondary">{subtitle}</p>
        )}
      </div>
    </>
  );

  const className = 'group block';
  return href ? (
    <Link href={href} className={className}>
      {inner}
    </Link>
  ) : (
    <div className={className}>{inner}</div>
  );
}

function subtitleFor(item: CollectionCard): string {
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
