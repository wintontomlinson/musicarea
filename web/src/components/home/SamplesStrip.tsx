'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { Song } from '@/lib/types';
import { pickImage } from '@/lib/utils';
import { Icon } from '@/components/ui/Icon';

/**
 * Entry point to the samples feed.
 *
 * A row of portrait tiles rather than the square cards used everywhere else on Home, because the
 * shape is the signal: it tells you the destination is a vertical, full-screen format before you
 * tap it. Every tile leads to the same feed rather than to its own track, since the feed is a
 * sequence and starting it at an arbitrary point would defeat the ordering.
 */
export function SamplesStrip({ songs }: { songs: Song[] }) {
  if (songs.length < 3) return null;

  return (
    <section aria-labelledby="samples-strip">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="section-kicker mb-1">Thirty seconds each</p>
          <h2 id="samples-strip" className="section-title">
            Samples
          </h2>
          <p className="mt-1 text-[13px] text-text-secondary">
            Swipe through short previews and keep the ones you like.
          </p>
        </div>
        <Link href="/samples" className="tint-chip shrink-0 hover:bg-accent/20 hover:text-white">
          Open <Icon name="chevronRight" size={13} />
        </Link>
      </div>

      <div className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:-mx-8 sm:px-8 lg:-mx-10 lg:px-10">
        {songs.slice(0, 8).map((song) => (
          <Link
            key={song.id}
            href="/samples"
            className="group relative aspect-[9/16] w-[7.5rem] shrink-0 snap-start overflow-hidden rounded-card border border-white/10 shadow-lift transition duration-300 hover:-translate-y-1 hover:border-accent-soft/45 hover:shadow-glow sm:w-[8.5rem]"
          >
            <Image
              src={pickImage(song.image)}
              alt={song.name}
              fill
              sizes="136px"
              className="object-cover transition duration-500 group-hover:scale-105"
            />
            <span
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent"
            />
            <span className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-black/45 text-white backdrop-blur-glass">
              <Icon name="samples" size={14} />
            </span>
            <span className="absolute inset-x-2 bottom-2">
              <span className="block truncate text-[12px] font-bold leading-tight text-white">
                {song.name}
              </span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
