'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { Song } from '@/lib/types';
import { usePlayer } from '@/stores/player';
import { artistLine, entityHref, pickImage } from '@/lib/utils';
import { Icon } from '@/components/ui/Icon';
import { LikeButton } from '@/components/library/LikeButton';
import { AddToPlaylistButton } from '@/components/library/AddToPlaylistButton';

/**
 * One full-viewport card in the samples feed.
 *
 * The artwork fills the card and is also its own blurred backdrop, so a square cover fills a
 * portrait screen without being stretched or letterboxed. Controls sit down the right edge, thumb
 * height, in the arrangement every short-form feed uses.
 */
export function SampleCard({
  song,
  active,
  all,
  progress,
}: {
  song: Song;
  /** True when this is the card in view and therefore the one playing. */
  active: boolean;
  /** The whole feed, so "play full song" can continue into the rest of it. */
  all: Song[];
  /** 0 to 1 through the preview window. */
  progress: number;
}) {
  const playQueue = usePlayer((state) => state.playQueue);
  const isPlaying = usePlayer((state) => state.isPlaying);
  const toggle = usePlayer((state) => state.toggle);
  const cover = pickImage(song.image);

  return (
    <section
      // `h-full` inside a scroll-snap container, so exactly one card occupies the viewport.
      className="relative flex h-full w-full snap-start snap-always items-end overflow-hidden"
      aria-label={`${song.name} by ${artistLine(song)}`}
    >
      <Image
        src={cover}
        alt=""
        fill
        priority={active}
        sizes="100vw"
        className="scale-125 object-cover opacity-45 blur-2xl"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[linear-gradient(to_top,rgb(var(--scrim-rgb)/.95)_0%,rgb(var(--scrim-rgb)/.45)_45%,rgb(var(--scrim-rgb)/.75)_100%)]"
      />

      {/* The cover itself, centred. Tapping it toggles playback, which is the expected gesture in
          a feed like this. */}
      <button
        type="button"
        onClick={toggle}
        aria-label={isPlaying ? 'Pause' : 'Play'}
        className="absolute inset-0 grid place-items-center"
      >
        <span className="relative block aspect-square w-[min(72vw,20rem)] overflow-hidden rounded-xl2 border border-white/20 shadow-art">
          <Image src={cover} alt={song.name} fill priority={active} sizes="320px" className="object-cover" />
          {active && !isPlaying && (
            <span className="absolute inset-0 grid place-items-center bg-black/45">
              <span className="grid h-16 w-16 place-items-center rounded-full bg-white/20 backdrop-blur-glass">
                <Icon name="play" size={30} />
              </span>
            </span>
          )}
        </span>
      </button>

      <div className="relative z-10 flex w-full items-end gap-4 p-5 pb-8">
        <div className="min-w-0 flex-1">
          <Link
            href={entityHref('song', song.name, song.id)}
            className="block font-display text-h3 font-extrabold tracking-[-0.03em] hover:underline"
          >
            {song.name}
          </Link>
          <p className="mt-1 truncate text-[14px] text-white/75">{artistLine(song)}</p>

          <button
            type="button"
            // Starts the full track from the beginning and queues the rest of the feed behind it,
            // so the preview turns into a listening session rather than a dead end.
            onClick={() => playQueue(all, all.indexOf(song))}
            className="button-primary mt-4"
          >
            <Icon name="play" size={15} />
            Play full song
          </button>
        </div>

        <div className="flex shrink-0 flex-col items-center gap-3">
          <LikeButton song={song} size={26} className="h-12 w-12 rounded-full bg-white/10 backdrop-blur-glass" />
          <AddToPlaylistButton song={song} size={24} className="h-12 w-12 bg-white/10 backdrop-blur-glass" />
        </div>
      </div>

      {/* Preview progress. A thin bar rather than a seek control: this is a 30 second excerpt, and
          there is nothing useful to scrub within it. */}
      <div className="absolute inset-x-0 bottom-0 z-10 h-[3px] bg-white/15" aria-hidden="true">
        <div
          className="h-full bg-accent transition-[width] duration-200 ease-linear"
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
      </div>
    </section>
  );
}
