import Image from 'next/image';
import Link from 'next/link';
import type { CollectionCard, Song } from '@/lib/types';
import { artistLine, entityHref, isSong, pickImage } from '@/lib/utils';
import { PlayButton } from '@/components/player/PlayButton';

export function MediaCard({ item, context }: { item: Song | CollectionCard; context?: Song[] }) {
  const cover = pickImage(item.image);
  const song = isSong(item);
  const subtitle = song ? artistLine(item) : subtitleFor(item);
  const href = hrefFor(item);

  const inner = (
    <>
      <div className="relative aspect-square overflow-hidden bg-surface-raised">
        <Image
          src={cover}
          alt={item.name}
          fill
          sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 200px"
          className="object-cover"
        />
        {song && <PlayButton song={item} list={context} className="absolute bottom-2 right-2 h-8 w-8" size={14} />}
      </div>
      <div className="mt-2">
        <p className="truncate text-sm font-semibold">{item.name}</p>
        {subtitle && <p className="mt-0.5 truncate text-xs text-text-secondary">{subtitle}</p>}
      </div>
    </>
  );

  const className = 'block';
  return href ? <Link href={href} className={className}>{inner}</Link> : <div className={className}>{inner}</div>;
}

function subtitleFor(item: CollectionCard): string {
  if (item.subtitle) return item.subtitle;
  if (item.type === 'album') return item.year ? `Album · ${item.year}` : 'Album';
  return item.songCount ? `Playlist · ${item.songCount} songs` : 'Playlist';
}

function hrefFor(item: Song | CollectionCard): string | null {
  if (isSong(item)) return entityHref('song', item.name, item.id);
  if (item.type === 'album') return entityHref('album', item.name, item.id);
  if (item.type === 'playlist') return entityHref('playlist', item.name, item.id);
  return null;
}
