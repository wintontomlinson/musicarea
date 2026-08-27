'use client';

import Link from 'next/link';
import type { Song } from '@/lib/types';
import { usePlayer } from '@/stores/player';
import { artistLine, entityHref, primaryArtist } from '@/lib/utils';
import { ReasonPill } from '@/components/home/ReasonPill';

/**
 * Title, artist and album for the immersive player.
 *
 * Apple Music typography: the title is set in the display face at a size well above any page
 * heading, tightly tracked, and the artist sits under it in the accent colour rather than in
 * grey. That accent line is what stops the block reading as a caption under a photo.
 *
 * The title wraps rather than truncating. It is the largest text on the screen and the whole
 * point of the view, so a long Bollywood title reading over two lines is better than one
 * ending in an ellipsis. The artist line does truncate, since it is secondary and often lists
 * six credits.
 *
 * Both artist and album link out, and clicking either closes the player, otherwise navigation
 * would happen invisibly behind a full-screen takeover.
 */
export function TrackMeta({ song }: { song: Song }) {
  const setFullscreen = usePlayer((state) => state.setFullscreen);
  const artist = primaryArtist(song);
  const close = () => setFullscreen(false);

  return (
    <div className="flex flex-col gap-2">
      <h1 className="font-display text-h2 font-extrabold leading-[1.05] tracking-[-0.04em] text-white sm:text-h1 lg:text-d2">
        {song.name}
      </h1>

      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        {artist?.id ? (
          <Link
            href={entityHref('artist', artist.name, artist.id)}
            onClick={close}
            className="truncate text-h5 font-bold text-accent-soft transition hover:text-white sm:text-h4"
          >
            {artistLine(song)}
          </Link>
        ) : (
          <span className="truncate text-h5 font-bold text-accent-soft sm:text-h4">
            {artistLine(song)}
          </span>
        )}

        {song.album?.name && song.album.id && (
          <>
            <span aria-hidden="true" className="text-white/30">
              ·
            </span>
            <Link
              href={entityHref('album', song.album.name, song.album.id)}
              onClick={close}
              className="truncate text-[13.5px] text-white/60 transition hover:text-white"
            >
              {song.album.name}
            </Link>
          </>
        )}
      </div>

      {/* Only present when this track arrived through the recommender, which is exactly where
          explaining it is useful: an unfamiliar song on a station wants a reason attached. */}
      <ReasonPill song={song} className="mt-0.5 self-start" />
    </div>
  );
}
