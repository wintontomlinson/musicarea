import Image from 'next/image';
import Link from 'next/link';
import type { CollectionCard, Song } from '@/lib/types';
import { Icon } from '@/components/ui/Icon';
import { artistLine, entityHref, isSong, pickImage } from '@/lib/utils';
import { PlayButton } from '@/components/player/PlayButton';

/**
 * The standard square tile for a song, album or playlist.
 *
 * Deliberately still a server component. It is the most-rendered component in the app
 * (a home page draws dozens), and the only interactive part is the play button, which is
 * already its own client component. Making the whole card client would ship the tile
 * markup to the browser for every row on the page to gain nothing.
 *
 * The hover treatment is the Spotify one: the tile lifts, the artwork scales inside its
 * own clipped box, and the play button rises into place. The scale sits on the image
 * rather than the card so the corners stay crisp, and the lift is small enough that a
 * grid does not appear to ripple as the cursor crosses it.
 */
export function MediaCard({ item, context }: { item: Song | CollectionCard; context?: Song[] }) {
  const cover = pickImage(item.image);
  const song = isSong(item);
  const subtitle = song ? artistLine(item) : subtitleFor(item);
  const href = hrefFor(item);

  const inner = (
    <>
      <div className="relative aspect-square overflow-hidden rounded-card border border-white/10 bg-surface-raised shadow-lift transition duration-300 group-hover:-translate-y-1 group-hover:border-accent-soft/45 group-hover:shadow-glow">
        <Image
          src={cover}
          alt={item.name}
          fill
          sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 200px"
          className="object-cover transition duration-500 group-hover:scale-105"
        />
        <span
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        />
        {song ? (
          <PlayButton
            song={item}
            list={context}
            className="absolute bottom-2.5 right-2.5 h-10 w-10 translate-y-2 opacity-0 transition duration-300 group-hover:translate-y-0 group-hover:opacity-100 focus:translate-y-0 focus:opacity-100"
            size={15}
          />
        ) : (
          // Collections have no playable list at this point (the songs live behind their
          // own request), so this is decorative and the card navigates instead. Marked
          // aria-hidden precisely because it is not a control.
          <span
            aria-hidden="true"
            className="absolute bottom-2.5 right-2.5 grid h-10 w-10 translate-y-2 place-items-center rounded-full bg-brand text-on-accent opacity-0 shadow-glow transition duration-300 group-hover:translate-y-0 group-hover:opacity-100"
          >
            <Icon name="play" size={15} />
          </span>
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
  // Upstream sometimes sends "0 songs" for a playlist it has not counted yet, which is
  // worse than saying nothing.
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
