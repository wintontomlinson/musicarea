import Image from 'next/image';
import Link from 'next/link';
import type { CollectionCard, Song } from '@/lib/types';
import { Icon } from '@/components/ui/Icon';
import { artistLine, entityHref, isSong, pickImage, primaryArtist } from '@/lib/utils';

/**
 * A single grid/carousel card for a song, album or playlist. Rounded 12px,
 * hover lift with a play button overlay, one-line title and a muted subtitle.
 * Songs are not yet clickable to a route in Phase 1 (the player and song page
 * arrive in later phases), so a song card links to its primary artist when one
 * exists and is otherwise a static tile; albums and playlists deep-link now.
 */
export function MediaCard({ item }: { item: Song | CollectionCard }) {
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
        <button
          type="button"
          aria-label={`Play ${item.name}`}
          className="absolute bottom-2 right-2 grid h-11 w-11 translate-y-2 place-items-center rounded-full bg-white text-black opacity-0 shadow-lift transition-all duration-150 group-hover:translate-y-0 group-hover:opacity-100"
        >
          <Icon name="play" size={18} />
        </button>
      </div>
      <div className="mt-3">
        <p className="truncate text-sm font-semibold">{item.name}</p>
        {subtitle && <p className="mt-0.5 truncate text-xs text-text-secondary">{subtitle}</p>}
      </div>
    </>
  );

  const className =
    'group block rounded-card p-2 transition-colors duration-150 hover:bg-white/5';

  if (href) {
    return (
      <Link href={href} className={className}>
        {inner}
      </Link>
    );
  }
  return <div className={className}>{inner}</div>;
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
  if (isSong(item)) {
    const a = primaryArtist(item);
    return a?.id ? entityHref('artist', a.name, a.id) : null;
  }
  if (item.type === 'album') return entityHref('album', item.name, item.id);
  if (item.type === 'playlist') return entityHref('playlist', item.name, item.id);
  return null;
}
