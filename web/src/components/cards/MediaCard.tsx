import Image from 'next/image';
import Link from 'next/link';
import type { CollectionCard, Song } from '@/lib/types';
import { Icon } from '@/components/ui/Icon';
import { artistLine, entityHref, isSong, pickImage } from '@/lib/utils';
import { PlayButton } from '@/components/player/PlayButton';

/**
 * Apple Music's shelf card: rounded artwork with a soft shadow, a play glyph
 * that fades in over the cover on hover, then the title and subtitle plainly
 * beneath it. No container box, so the artwork carries the card.
 */
export function MediaCard({ item, context }: { item: Song | CollectionCard; context?: Song[] }) {
  const cover = pickImage(item.image);
  const song = isSong(item);
  const subtitle = song ? artistLine(item) : subtitleFor(item);
  const href = hrefFor(item);

  const inner = (
    <>
      <div className="relative aspect-square overflow-hidden rounded-card bg-surface-raised shadow-lift">
        <Image
          src={cover}
          alt={item.name}
          fill
          sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 200px"
          className="object-cover"
        />
        {song ? (
          <PlayButton
            song={item}
            list={context}
            className="absolute bottom-2 left-2 h-9 w-9 opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus:opacity-100"
            size={15}
          />
        ) : (
          <span
            aria-hidden="true"
            className="absolute bottom-2 left-2 grid h-9 w-9 place-items-center rounded-full bg-black/55 text-white opacity-0 backdrop-blur transition-opacity duration-150 group-hover:opacity-100"
          >
            <Icon name="play" size={15} />
          </span>
        )}
      </div>
      <div className="mt-2">
        <p className="truncate text-[14px] font-medium leading-tight">{item.name}</p>
        {subtitle && (
          <p className="mt-0.5 truncate text-[13px] leading-tight text-text-secondary">{subtitle}</p>
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
  // Browse rows sometimes carry a "0 songs" subtitle for albums whose track
  // list has not been expanded yet. That is noise, so fall through to the year.
  const provided =
    item.subtitle && !/^0\s+songs?$/i.test(item.subtitle.trim()) ? item.subtitle : '';
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
