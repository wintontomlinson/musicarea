'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useLibrary } from '@/stores/library';
import { usePlayer } from '@/stores/player';
import { CollectionActions } from '@/components/player/CollectionActions';
import { EmptyState } from '@/components/ui/EmptyState';
import { TrackListSkeleton } from '@/components/ui/Skeleton';
import { Modal } from '@/components/ui/Modal';
import { Icon } from '@/components/ui/Icon';
import { SongMenu } from '@/components/tracks/SongMenu';
import { FavoriteButton } from '@/components/library/FavoriteButton';
import { artistLine, entityHref, pickImage, relativeTime } from '@/lib/utils';
import { notify } from '@/stores/toast';

/**
 * Recently played. Each track appears once, at its most recent play, with a play
 * count when it has been heard more than once. Recorded on this device only.
 */
export function HistoryView() {
  const hydrated = useLibrary((s) => s.hydrated);
  const history = useLibrary((s) => s.history);
  const clearHistory = useLibrary((s) => s.clearHistory);
  const playQueue = usePlayer((s) => s.playQueue);
  const [confirming, setConfirming] = useState(false);

  const songs = history.map((entry) => entry.song);

  return (
    <div className="page page-stack">
      <header>
        <p className="t-micro">Your collection</p>
        <h1 className="mt-2 t-display">Recently Played</h1>
        {hydrated && history.length > 0 && (
          <p className="mt-2.5 t-meta">
            {history.length} {history.length === 1 ? 'track' : 'tracks'} on this device
          </p>
        )}

        {hydrated && history.length > 0 && (
          <div className="mt-6 flex flex-wrap items-center gap-2.5">
            <CollectionActions songs={songs} />
            <button type="button" onClick={() => setConfirming(true)} className="btn-ghost text-meta">
              <Icon name="trash" size={15} />
              Clear history
            </button>
          </div>
        )}
      </header>

      {!hydrated ? (
        <TrackListSkeleton rows={8} />
      ) : history.length ? (
        <div className="flex flex-col">
          {history.map((entry, index) => (
            <div
              key={entry.song.id}
              className="row row-idle group grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-3 px-2 py-2 sm:grid-cols-[44px_minmax(0,1fr)_auto_auto_auto]"
            >
              <button
                type="button"
                onClick={() => playQueue(songs, index)}
                aria-label={`Play ${entry.song.name}`}
                className="relative h-11 w-11 overflow-hidden rounded-sm bg-surface-raised"
              >
                <Image
                  src={pickImage(entry.song.image, '150x150')}
                  alt=""
                  fill
                  sizes="44px"
                  className="object-cover"
                />
                <span className="absolute inset-0 grid place-items-center bg-black/50 opacity-0 transition-opacity duration-fast group-hover:opacity-100">
                  <Icon name="play" size={14} />
                </span>
              </button>

              <div className="min-w-0">
                <Link
                  href={entityHref('song', entry.song.name, entry.song.id)}
                  className="block truncate text-body font-medium hover:underline"
                >
                  {entry.song.name}
                </Link>
                <p className="mt-0.5 truncate text-meta text-text-secondary">
                  {artistLine(entry.song)}
                </p>
              </div>

              <span className="hidden text-meta text-text-muted sm:block">
                {relativeTime(entry.at)}
              </span>

              <span className="hidden text-meta tabular-nums text-text-muted sm:block">
                {entry.plays > 1 ? `${entry.plays} plays` : ''}
              </span>

              <div className="flex items-center gap-1">
                <span className="hidden opacity-0 transition-opacity duration-fast group-hover:opacity-100 focus-within:opacity-100 sm:inline">
                  <FavoriteButton song={entry.song} size={16} />
                </span>
                <SongMenu song={entry.song} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon="clock"
          title="No listening history yet"
          message="Play something for a few seconds and it will show up here."
          ctaHref="/"
          ctaLabel="Start listening"
        />
      )}

      <Modal
        open={confirming}
        onClose={() => setConfirming(false)}
        title="Clear listening history?"
        description="This removes the record of what you played on this device. Liked songs and playlists are not affected."
        footer={
          <>
            <button type="button" onClick={() => setConfirming(false)} className="btn-secondary">
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                clearHistory();
                setConfirming(false);
                notify('Listening history cleared');
              }}
              className="btn-primary"
            >
              Clear history
            </button>
          </>
        }
      />
    </div>
  );
}
