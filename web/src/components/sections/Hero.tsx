import Image from 'next/image';
import Link from 'next/link';
import type { Song } from '@/lib/types';
import { artistLine, entityHref, formatDuration, pickImage, primaryArtist } from '@/lib/utils';
import { PlayPill } from '@/components/player/PlayPill';
import { SongMenu } from '@/components/tracks/SongMenu';

/**
 * Featured release panel at the top of Home.
 *
 * The artwork provides the colour: an enlarged, blurred copy sits behind a dark
 * horizontal scrim and a vignette, with the sharp cover on the right. No
 * decorative gradient is layered on top, so the panel takes its identity from
 * whatever is actually being featured.
 *
 * The page owns the h1, so the release title is an h2.
 */
export function Hero({ song }: { song: Song }) {
  const cover = pickImage(song.image);
  const artist = primaryArtist(song);

  const meta = [
    song.album?.name,
    song.year ? String(song.year) : null,
    song.duration ? formatDuration(song.duration) : null,
  ].filter(Boolean) as string[];

  return (
    <section className="relative overflow-hidden rounded-xl border border-subtle bg-surface">
      {/* Ambient artwork wash. */}
      <Image
        src={cover}
        alt=""
        fill
        priority
        sizes="100vw"
        className="scale-110 object-cover opacity-40 blur-2xl"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-r from-[#080808] via-[#080808]/85 to-[#080808]/35"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{ boxShadow: 'inset 0 0 140px 40px rgba(0,0,0,0.75)' }}
      />

      <div className="relative flex min-h-[300px] flex-col justify-end gap-7 p-5 sm:min-h-[360px] sm:flex-row sm:items-end sm:justify-between sm:p-8 lg:p-10">
        <div className="min-w-0 max-w-xl">
          <p className="t-micro">Featured</p>

          <h2 className="mt-3 clamp-2 text-title font-bold tracking-[-0.028em] sm:text-[38px] sm:leading-[1.06]">
            <Link
              href={entityHref('song', song.name, song.id)}
              className="transition-opacity duration-fast hover:opacity-90"
            >
              {song.name}
            </Link>
          </h2>

          <p className="mt-2.5 truncate text-body text-text-secondary sm:text-[15px]">
            {artist?.id ? (
              <Link
                href={entityHref('artist', artist.name, artist.id)}
                className="font-medium text-text transition-colors duration-fast hover:underline"
              >
                {artistLine(song)}
              </Link>
            ) : (
              <span className="font-medium text-text">{artistLine(song)}</span>
            )}
            {meta.length > 0 && <span className="text-text-muted"> · {meta.join(' · ')}</span>}
          </p>

          <div className="mt-7 flex items-center gap-2">
            <PlayPill song={song} />
            <SongMenu song={song} />
          </div>
        </div>

        <div className="relative aspect-square w-28 shrink-0 self-start overflow-hidden rounded-lg border border-subtle shadow-art sm:w-44 sm:self-end lg:w-52">
          <Image
            src={cover}
            alt={song.name}
            fill
            priority
            sizes="(max-width: 640px) 112px, 208px"
            className="object-cover"
          />
        </div>
      </div>
    </section>
  );
}
