'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useLibrary } from '@/stores/library';
import { usePlayer } from '@/stores/player';
import { TrackList } from '@/components/sections/TrackList';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Skeleton } from '@/components/ui/Skeleton';
import { artistLine, entityHref, pickImage } from '@/lib/utils';

/**
 * Library overview.
 *
 * A hub rather than a list: counts for each collection, a preview of the most
 * recent listening, and the queue for the current session. Everything shown here
 * comes from this device, and the footnote says so explicitly rather than
 * implying an account that does not exist.
 */
export function LibraryHub() {
  const hydrated = useLibrary((s) => s.hydrated);
  const songs = useLibrary((s) => s.songs);
  const history = useLibrary((s) => s.history);
  const playlists = useLibrary((s) => s.playlists);
  const albums = useLibrary((s) => s.collections.filter((entry) => entry.type === 'album'));
  const artists = useLibrary((s) => s.collections.filter((entry) => entry.type === 'artist'));

  const queue = usePlayer((s) => s.queue);
  const setQueueOpen = usePlayer((s) => s.setQueueOpen);

  const recentSongs = history.slice(0, 6).map((entry) => entry.song);
  const isEmpty =
    hydrated &&
    songs.length === 0 &&
    history.length === 0 &&
    playlists.length === 0 &&
    albums.length === 0 &&
    artists.length === 0;

  return (
    <div className="page page-stack">
      <header>
        <h1 className="t-display">Your Library</h1>
        <p className="mt-2.5 max-w-xl text-body leading-relaxed text-text-secondary">
          Saved music, playlists and listening history, kept on this device.
        </p>
      </header>

      <section aria-label="Collections">
        <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
          <CountTile
            href="/liked"
            icon="heart"
            label="Liked Songs"
            count={songs.length}
            unit="song"
            hydrated={hydrated}
          />
          <CountTile
            href="/history"
            icon="clock"
            label="Recently Played"
            count={history.length}
            unit="track"
            hydrated={hydrated}
          />
          <CountTile
            href="/playlists"
            icon="playlist"
            label="Playlists"
            count={playlists.length}
            unit="playlist"
            hydrated={hydrated}
          />
          <CountTile
            href="/albums"
            icon="disc"
            label="Albums"
            count={albums.length}
            unit="album"
            hydrated={hydrated}
          />
          <CountTile
            href="/artists"
            icon="user"
            label="Artists"
            count={artists.length}
            unit="artist"
            hydrated={hydrated}
          />
        </div>
      </section>

      {isEmpty && (
        <EmptyState
          icon="library"
          title="Your library is empty"
          message="Like a song, save an album or build a playlist and it will collect here."
          ctaHref="/explore"
          ctaLabel="Explore music"
          secondaryHref="/charts"
          secondaryLabel="Browse charts"
        />
      )}

      {recentSongs.length > 0 && (
        <section aria-labelledby="library-recent">
          <div className="mb-4 flex items-end justify-between gap-4">
            <h2 id="library-recent" className="text-section">
              Jump back in
            </h2>
            <Link href="/history" className="link-quiet">
              See all
              <Icon name="chevronRight" size={13} />
            </Link>
          </div>
          <TrackList songs={recentSongs} showAlbum={false} />
        </section>
      )}

      {playlists.length > 0 && (
        <section aria-labelledby="library-playlists">
          <div className="mb-4 flex items-end justify-between gap-4">
            <h2 id="library-playlists" className="text-section">
              Your playlists
            </h2>
            <Link href="/playlists" className="link-quiet">
              See all
              <Icon name="chevronRight" size={13} />
            </Link>
          </div>
          <div className="bleed-row no-scrollbar pb-1">
            {playlists.slice(0, 10).map((playlist) => {
              const cover = playlist.songs[0]?.image;
              return (
                <Link
                  key={playlist.id}
                  href={`/playlists/${playlist.id}`}
                  className="group w-[150px] shrink-0 snap-start sm:w-[168px]"
                >
                  <span className="relative mb-3 block aspect-square overflow-hidden rounded bg-surface-raised shadow-art">
                    {cover ? (
                      <Image
                        src={pickImage(cover)}
                        alt=""
                        fill
                        sizes="168px"
                        className="object-cover transition-transform duration-base ease-out group-hover:scale-[1.03]"
                      />
                    ) : (
                      <span className="grid h-full w-full place-items-center text-text-muted">
                        <Icon name="playlist" size={24} />
                      </span>
                    )}
                  </span>
                  <p className="truncate text-body font-semibold group-hover:underline">
                    {playlist.name}
                  </p>
                  <p className="mt-1 truncate text-meta text-text-secondary">
                    {playlist.songs.length} {playlist.songs.length === 1 ? 'track' : 'tracks'}
                  </p>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {queue.length > 0 && (
        <section aria-labelledby="library-queue">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <h2 id="library-queue" className="text-section">
                This session
              </h2>
              <p className="mt-1 t-meta">
                {queue.length} {queue.length === 1 ? 'track' : 'tracks'} in the queue
              </p>
            </div>
            <button type="button" onClick={() => setQueueOpen(true)} className="chip">
              <Icon name="queue" size={14} />
              Manage queue
            </button>
          </div>
          <TrackList songs={queue.slice(0, 5)} showAlbum={false} />
        </section>
      )}

      <p className="border-t border-subtle pt-6 text-meta leading-relaxed text-text-muted">
        MusicArea has no accounts. Your library, playback preferences and listening languages are
        stored in this browser, so they do not follow you to another device and clearing site data
        will remove them.
      </p>
    </div>
  );
}

function CountTile({
  href,
  icon,
  label,
  count,
  unit,
  hydrated,
}: {
  href: string;
  icon: IconName;
  label: string;
  count: number;
  unit: string;
  hydrated: boolean;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded border border-subtle bg-surface px-4 py-3.5 transition-colors duration-fast hover:border-strong hover:bg-surface-raised"
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-sm bg-white/5 text-text-secondary transition-colors duration-fast group-hover:text-accent">
        <Icon name={icon} size={18} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-body font-semibold">{label}</span>
        {hydrated ? (
          <span className="mt-0.5 block text-micro text-text-muted">
            {count} {count === 1 ? unit : `${unit}s`}
          </span>
        ) : (
          <Skeleton className="mt-1.5 h-2.5 w-16" />
        )}
      </span>
      <Icon
        name="chevronRight"
        size={15}
        className="shrink-0 text-text-muted transition-transform duration-fast group-hover:translate-x-0.5"
      />
    </Link>
  );
}
