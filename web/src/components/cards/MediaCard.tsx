import Image from 'next/image';
import Link from 'next/link';
import type { CollectionCard, Song } from '@/lib/types';
import { Icon } from '@/components/ui/Icon';
import { artistLine, entityHref, isSong, pickImage } from '@/lib/utils';
import { PlayButton } from '@/components/player/PlayButton';

/**
 * A shelf/grid card for a song, album or playlist: square artwork, a play
 * affordance on hover, then title and subtitle. No overlays or tinting, so the
 * artwork is the only colour.
 */
export function MediaCard({ item, context }: { item: Song | CollectionCard; context?: Song[] }) {
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
          className="object-cover"
        />
        {song ? (
          <PlayButton
            song={item}
            list={context}
            className="absolute bottom-2 right-2 h-10 w-10 opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus:opacity-100"
            size={16}
          />
        ) : (
          <span
            aria-hidden="true"
            className="absolute bottom-2 right-2 grid h-10 w-10 place-items-center rounded-full bg-white text-black opacity-0 transition-opacity duration-150 group-hover:opacity-100"
          >
            <Icon name="play" size={16} />
          </span>
        )}
      </div>
      <div className="mt-2.5 px-0.5">
        <p className="truncate text-sm font-semibold">{item.name}</p>
        {subtitle && <p className="mt-0.5 truncate text-xs text-text-secondary">{subtitle}</p>}
      </div>
    </>
  );

  const className = 'group block rounded-card p-1.5 transition-colors hover:bg-white/5';
  return href ? (
    <Link href={href} className={className}>
      {inner}
    </Link>
  ) : (
    <div className={className}>{inner}</div>
  );
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
