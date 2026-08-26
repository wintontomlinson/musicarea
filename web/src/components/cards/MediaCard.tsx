import Image from 'next/image';
import Link from 'next/link';
import type { CollectionCard, Song } from '@/lib/types';
import { Icon } from '@/components/ui/Icon';
import { artistLine, entityHref, isSong, pickImage } from '@/lib/utils';
import { PlayButton } from '@/components/player/PlayButton';

export function MediaCard({ item, context }: { item: Song | CollectionCard; context?: Song[] }) {
  const cover = pickImage(item.image);
  const song = isSong(item);
  const subtitle = song ? artistLine(item) : subtitleFor(item);
  const href = hrefFor(item);
  const inner = (
    <>
      <div className="relative aspect-square overflow-hidden rounded-card border border-white/10 bg-surface-raised transition-colors group-hover:border-white/25">
        <Image src={cover} alt={item.name} fill sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 200px" className="object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
        {song ? (
          <PlayButton song={item} list={context} className="absolute bottom-2.5 left-2.5 h-9 w-9 opacity-0 transition-opacity duration-200 group-hover:opacity-100 focus:opacity-100" size={14} />
        ) : (
          <span aria-hidden="true" className="absolute bottom-2.5 left-2.5 grid h-9 w-9 place-items-center rounded-full bg-white text-black opacity-0 transition-opacity duration-200 group-hover:opacity-100"><Icon name="play" size={14} /></span>
        )}
      </div>
      <div className="mt-2.5"><p className="truncate text-[14px] font-semibold leading-tight text-white">{item.name}</p>{subtitle && <p className="mt-1 truncate text-[12px] leading-tight text-text-secondary">{subtitle}</p>}</div>
    </>
  );
  const className = 'group block';
  return href ? <Link href={href} className={className}>{inner}</Link> : <div className={className}>{inner}</div>;
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
