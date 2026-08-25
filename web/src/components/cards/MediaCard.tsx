import Image from 'next/image';
import Link from 'next/link';
import type { CollectionCard, Song } from '@/lib/types';
import { Icon } from '@/components/ui/Icon';
import { artistLine, entityHref, isSong, pickImage } from '@/lib/utils';
import { PlayButton } from '@/components/player/PlayButton';

export function MediaCard({
  item,
  context,
}: {
  item: Song | CollectionCard;
  context?: Song[];
}) {
  const cover = pickImage(item.image);
  const song = isSong(item);
  const subtitle = song ? artistLine(item) : subtitleFor(item);
  const href = hrefFor(item);

  const inner = (
    <>
      <div className="relative aspect-square overflow-hidden rounded-card bg-surface-raised">
        <Image
          src={cover}
          alt={item.name}
          fill
          sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 200px"
          className="object-cover transition-transform duration-300 group-hover:scale-105"
        />
        {song ? (
          <PlayButton
            song={item}
            list={context}
            className="absolute bottom-2 right-2 h-9 w-9 opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
            size={16}
          />
        ) : (
          <span
            aria-hidden="true"
            className="absolute bottom-2 right-2 grid h-9 w-9 place-items-center rounded-full bg-white text-black opacity-0 transition-opacity group-hover:opacity-100"
          >
            <Icon name="play" size={16} />
          </span>
        )}
      </div>
      <div className="mt-2">
        <p className="truncate text-sm font-semibold">{item.name}</p>
        {subtitle && <p className="mt-0.5 truncate text-xs text-text-secondary">{subtitle}</p>}
      </div>
    </>
  );

  const className = 'group block rounded-card p-1.5 transition-colors hover:bg-white/5';
  return href ? <Link href={href} className={className}>{inner}</Link> : <div className={className}>{inner}</div>;
}

function subtitleFor(item: CollectionCard): string {
  if (item.subtitle) return item.subtitle;
  if (item.type === 'album') {
    const year = item.year ? String(item.year) : '';
    return year ? `Album · ${year}` : 'Album';
  }
  const count = item.songCount ? `${item.songCount} songs` : '';
  return count ? `Playlist · ${count}` : 'Playlist';
}

function hrefFor(item: Song | CollectionCard): string | null {
  if (isSong(item)) return entityHref('song', item.name, item.id);
  if (item.type === 'album') return entityHref('album', item.name, item.id);
  if (item.type === 'playlist') return entityHref('playlist', item.name, item.id);
  return null;
}
