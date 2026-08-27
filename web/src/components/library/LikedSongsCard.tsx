'use client';

import Image from 'next/image';
import Link from 'next/link';
import { m } from 'motion/react';
import type { Song } from '@/lib/types';
import { usePlayer } from '@/stores/player';
import { pickImage } from '@/lib/utils';
import { Icon } from '@/components/ui/Icon';
import { SPRING_SNAP } from '@/lib/motion';

/**
 * The Liked Songs hero card.
 *
 * A fixed violet gradient rather than the artwork palette, which is the one deliberate exception
 * to this app's adaptive theming. Liked Songs is a permanent fixture of the library and needs to
 * be recognisable at a glance every time; if it took its colour from whatever happens to be
 * playing it would look like a different card on every visit. Spotify makes the same call for the
 * same reason.
 *
 * The artwork is a collage of the four most recently liked covers, so the card is visibly *yours*
 * without needing a cover image the app does not have.
 */
export function LikedSongsCard({ songs }: { songs: Song[] }) {
  const playQueue = usePlayer((state) => state.playQueue);
  const covers = songs.slice(0, 4).map((song) => pickImage(song.image, '150x150'));

  return (
    <m.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="group relative overflow-hidden rounded-card-lg shadow-lift"
    >
      {/* Not a theme token: see the note above. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[linear-gradient(135deg,#5b21b6_0%,#7c3aed_45%,#a855f7_100%)]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(circle_at_88%_12%,rgba(255,255,255,0.22),transparent_45%)]"
      />

      <div className="relative flex items-center gap-4 p-4 sm:gap-5 sm:p-5">
        <Link
          href="/liked"
          aria-label="Open liked songs"
          className="relative h-20 w-20 shrink-0 overflow-hidden rounded-card border border-white/25 shadow-lift sm:h-24 sm:w-24"
        >
          {covers.length >= 4 ? (
            <span className="grid h-full w-full grid-cols-2 grid-rows-2">
              {covers.map((cover, index) => (
                <span key={index} className="relative">
                  <Image src={cover} alt="" fill sizes="48px" className="object-cover" />
                </span>
              ))}
            </span>
          ) : covers.length > 0 ? (
            <Image src={covers[0]} alt="" fill sizes="96px" className="object-cover" />
          ) : (
            // No liked songs yet, so there is no collage to build. A heart on the gradient reads
            // as the card's identity rather than as a missing image.
            <span className="grid h-full w-full place-items-center bg-white/15 text-white">
              <Icon name="heart" size={30} />
            </span>
          )}
        </Link>

        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-white/75">Playlist</p>
          <Link href="/liked" className="mt-1 block">
            <h2 className="font-display text-h3 font-extrabold tracking-[-0.03em] text-white hover:underline">
              Liked songs
            </h2>
          </Link>
          <p className="mt-1 text-[13px] text-white/80">
            {songs.length === 0
              ? 'Tap the heart on any track'
              : `${songs.length} ${songs.length === 1 ? 'song' : 'songs'}`}
          </p>
        </div>

        {songs.length > 0 && (
          <m.button
            type="button"
            onClick={() => playQueue(songs, 0)}
            aria-label="Play liked songs"
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.94 }}
            transition={SPRING_SNAP}
            // Fixed white on the violet rather than an accent fill, for the same reason as the
            // gradient: the card is a constant, and `text-on-accent` would shift with the artwork.
            className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white text-[#4c1d95] shadow-lift sm:h-14 sm:w-14"
          >
            <Icon name="play" size={20} />
          </m.button>
        )}
      </div>
    </m.div>
  );
}
