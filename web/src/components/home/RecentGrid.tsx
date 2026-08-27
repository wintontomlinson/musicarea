'use client';

import Image from 'next/image';
import Link from 'next/link';
import { m } from 'motion/react';
import type { Song } from '@/lib/types';
import { usePlayer } from '@/stores/player';
import { artistLine, entityHref, pickImage } from '@/lib/utils';
import { Icon } from '@/components/ui/Icon';
import { staggerContainer, staggerItem } from '@/lib/motion';

/**
 * Recently played, as a compact grid of wide tiles.
 *
 * Two columns on mobile and three from the tablet breakpoint, per the brief. The tiles
 * are horizontal rather than square because this section is about recognition, not
 * discovery: the listener already knows these tracks, so a small cover plus the title
 * identifies one faster than a large cover would, and it fits twice as many on screen.
 *
 * The whole tile is a link to the song, with playback on a nested button. Making the
 * tile itself play would remove the only route from here to the song's page and break
 * opening it in a new tab.
 */
export function RecentGrid({ songs }: { songs: Song[] }) {
  const playQueue = usePlayer((state) => state.playQueue);
  const currentId = usePlayer((state) => state.currentTrack()?.id);

  if (songs.length === 0) return null;

  const items = songs.slice(0, 6);

  return (
    <section aria-labelledby="recent-grid">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="section-kicker mb-1">Back where you were</p>
          <h2 id="recent-grid" className="section-title">
            Recently played
          </h2>
        </div>
        <Link href="/recent" className="tint-chip shrink-0 hover:bg-accent/20 hover:text-white">
          See all <Icon name="chevronRight" size={13} />
        </Link>
      </div>

      <m.ul
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 gap-2.5 lg:grid-cols-3"
      >
        {items.map((song) => {
          const active = song.id === currentId;
          return (
            <m.li key={song.id} variants={staggerItem} className="group relative">
              <Link
                href={entityHref('song', song.name, song.id)}
                className={`flex items-center gap-3 overflow-hidden rounded-card border pr-10 transition ${
                  active
                    ? 'border-accent/35 bg-accent/[0.1]'
                    : 'border-white/[0.08] bg-white/[0.04] hover:border-white/20 hover:bg-white/[0.08]'
                }`}
              >
                {/* Square, flush to the tile's left edge, so the artwork reads as part
                    of the tile rather than as an inset thumbnail. */}
                <span className="relative h-14 w-14 shrink-0 sm:h-16 sm:w-16">
                  <Image
                    src={pickImage(song.image, '150x150')}
                    alt=""
                    fill
                    sizes="64px"
                    className="object-cover"
                  />
                </span>
                <span className="min-w-0 flex-1 py-2">
                  <span
                    className={`block truncate text-[13px] font-bold leading-tight ${
                      active ? 'text-accent-soft' : ''
                    }`}
                  >
                    {song.name}
                  </span>
                  <span className="mt-0.5 block truncate text-[11.5px] leading-tight text-text-secondary">
                    {artistLine(song)}
                  </span>
                </span>
              </Link>

              {/* Always visible on touch, hover-revealed on pointer devices: there is no
                  hover on a phone, so an opacity-0 control would be unreachable there. */}
              <button
                type="button"
                aria-label={`Play ${song.name}`}
                onClick={() => playQueue(items, items.indexOf(song))}
                className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-brand text-on-accent shadow-glow transition lg:opacity-0 lg:group-hover:opacity-100 lg:focus-visible:opacity-100"
              >
                <Icon name="play" size={14} />
              </button>
            </m.li>
          );
        })}
      </m.ul>
    </section>
  );
}
