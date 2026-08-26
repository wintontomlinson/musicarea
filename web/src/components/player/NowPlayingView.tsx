'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePlayer } from '@/stores/player';
import { artistLine, entityHref, pickImage, primaryArtist } from '@/lib/utils';
import { Icon } from '@/components/ui/Icon';
import { TransportControls } from './PlayerControls';
import { SeekBar } from './SeekBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { shareLink } from '@/lib/share';
import { FavoriteButton } from '@/components/library/FavoriteButton';

/**
 * The Now Playing content: large artwork, track identity, seek rail, transport
 * and secondary tools.
 *
 * Shared by the full-screen overlay and the /now-playing route so both stay
 * identical, and so the screen is reachable by URL as well as by gesture.
 */
export function NowPlayingView({ onClose }: { onClose?: () => void }) {
  const track = usePlayer((s) => s.currentTrack());
  const setQueueOpen = usePlayer((s) => s.setQueueOpen);
  const setLyricsOpen = usePlayer((s) => s.setLyricsOpen);
  const queueLength = usePlayer((s) => s.queue.length);
  const orderPos = usePlayer((s) => s.orderPos);

  if (!track) {
    return (
      <div className="grid min-h-[60vh] place-items-center px-6">
        <EmptyState
          icon="disc"
          title="Nothing playing"
          message="Choose a song and it will appear here."
          ctaHref="/"
          ctaLabel="Browse music"
        />
      </div>
    );
  }

  const cover = pickImage(track.image);
  const artist = primaryArtist(track);
  const songHref = entityHref('song', track.name, track.id);

  return (
    <div className="mx-auto flex w-full max-w-[440px] flex-col px-6 pb-10">
      {/* Header */}
      <div className="flex h-16 shrink-0 items-center justify-between">
        {onClose ? (
          <button
            type="button"
            aria-label="Close player"
            onClick={onClose}
            className="btn-icon"
          >
            <Icon name="collapse" size={20} />
          </button>
        ) : (
          <span className="h-9 w-9" />
        )}

        <p className="text-micro uppercase tracking-[0.09em] text-text-secondary">
          {queueLength > 1 ? `Track ${orderPos + 1} of ${queueLength}` : 'Now playing'}
        </p>

        <button
          type="button"
          aria-label="Queue"
          onClick={() => setQueueOpen(true)}
          className="btn-icon"
        >
          <Icon name="queue" size={18} />
        </button>
      </div>

      {/* Artwork */}
      <div className="relative mt-2 aspect-square w-full overflow-hidden rounded-xl border border-subtle bg-surface shadow-pop">
        <Image
          src={cover}
          alt={track.name}
          fill
          priority
          sizes="440px"
          className="object-cover"
        />
      </div>

      {/* Identity */}
      <div className="mt-8 min-w-0">
        <h1 className="truncate text-[22px] font-bold tracking-[-0.02em]">
          <Link href={songHref} onClick={onClose} className="hover:underline">
            {track.name}
          </Link>
        </h1>
        <p className="mt-1.5 truncate text-body text-text-secondary">
          {artist?.id ? (
            <Link
              href={entityHref('artist', artist.name, artist.id)}
              onClick={onClose}
              className="transition-colors duration-fast hover:text-text hover:underline"
            >
              {artistLine(track)}
            </Link>
          ) : (
            artistLine(track)
          )}
        </p>
      </div>

      {/* Seek */}
      <div className="mt-7">
        <SeekBar showTimes size="lg" />
      </div>

      {/* Transport */}
      <div className="mt-5">
        <TransportControls size="full" />
      </div>

      {/* Secondary tools */}
      <div className="mt-9 flex flex-wrap items-center justify-center gap-1 border-t border-subtle pt-5">
        <FavoriteButton song={track} size={18} className="h-10 w-10" />
        <button
          type="button"
          onClick={() => setLyricsOpen(true)}
          className="btn-ghost text-meta"
        >
          <Icon name="lyrics" size={16} />
          Lyrics
        </button>
        <button
          type="button"
          onClick={() => setQueueOpen(true)}
          className="btn-ghost text-meta"
        >
          <Icon name="queue" size={16} />
          Queue
        </button>
        <button
          type="button"
          onClick={() => void shareLink(songHref, `${track.name} by ${artistLine(track)}`)}
          className="btn-ghost text-meta"
        >
          <Icon name="share" size={16} />
          Share
        </button>
      </div>
    </div>
  );
}

/** Ambient artwork background, shared by the overlay and the route. */
export function NowPlayingBackdrop({ cover }: { cover: string }) {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <Image src={cover} alt="" fill priority sizes="100vw" className="scale-125 object-cover opacity-25 blur-3xl" />
      <div className="absolute inset-0 bg-gradient-to-b from-[#080808]/70 via-[#080808]/85 to-[#080808]" />
    </div>
  );
}
