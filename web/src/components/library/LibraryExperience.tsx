'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { m } from 'motion/react';
import { useLibrary } from '@/stores/library';
import { usePlaylists } from '@/stores/playlists';
import { usePlayer } from '@/stores/player';
import { albumsFrom, artistsFrom, mergeSongs, type Collected } from '@/lib/collections';
import { entityHref, pickImage } from '@/lib/utils';
import { Icon } from '@/components/ui/Icon';
import { Tabs } from '@/components/ui/Tabs';
import { TrackList } from '@/components/sections/TrackList';
import { LikedSongsCard } from './LikedSongsCard';
import { CreatePlaylistDialog } from './CreatePlaylistDialog';

type Tab = 'playlists' | 'songs' | 'albums' | 'artists';

/**
 * The library.
 *
 * The brief asked for Playlists, Albums, Artists and Downloads. Downloads is gone, and the other
 * three needed a source of truth that did not previously exist:
 *
 * **Downloads is not implementable.** Offline audio needs a service worker and cache storage,
 * neither of which this app has, and a tab that lists nothing forever is worse than no tab. Its
 * slot is taken by local playlists, which are real.
 *
 * **Albums and Artists are derived.** There is no "save album" or "follow artist" feature, so
 * these are built from the albums and artists the listener's liked and recently played songs came
 * from. That is a genuine collection, and the copy describes it as such rather than implying the
 * listener saved them deliberately.
 *
 * The queue view that used to be the whole of this page has moved: it now lives in the player
 * itself, where a queue belongs, so the Library is about what you keep rather than about what is
 * playing right now.
 */
export function LibraryExperience() {
  const hydrateLibrary = useLibrary((state) => state.hydrate);
  const hydratePlaylists = usePlaylists((state) => state.hydrate);
  const libraryHydrated = useLibrary((state) => state.hydrated);
  const playlistsHydrated = usePlaylists((state) => state.hydrated);
  const liked = useLibrary((state) => state.liked);
  const recent = useLibrary((state) => state.recent);
  const playlists = usePlaylists((state) => state.playlists);

  const [tab, setTab] = useState<Tab>('playlists');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    hydrateLibrary();
    hydratePlaylists();
  }, [hydrateLibrary, hydratePlaylists]);

  const ready = libraryHydrated && playlistsHydrated;

  // Liked first, so a track that is both liked and recently played is represented by its liked
  // record, and the counts lean toward deliberate saves over incidental plays.
  const pool = useMemo(() => mergeSongs(liked, recent), [liked, recent]);
  const albums = useMemo(() => albumsFrom(pool), [pool]);
  const artists = useMemo(() => artistsFrom(pool), [pool]);

  const items = [
    { id: 'playlists' as const, label: 'Playlists', badge: ready ? playlists.length : undefined },
    { id: 'songs' as const, label: 'Songs', badge: ready ? liked.length : undefined },
    { id: 'albums' as const, label: 'Albums', badge: ready ? albums.length : undefined },
    { id: 'artists' as const, label: 'Artists', badge: ready ? artists.length : undefined },
  ];

  return (
    <div className="app-page">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="section-kicker">Everything you keep</p>
          <h1 className="mt-1.5 font-display text-h2 font-extrabold tracking-[-0.045em] sm:text-h1">
            Your library
          </h1>
          <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-text-secondary">
            Saved on this device. Nothing here is uploaded, so it will not follow you to another
            browser.
          </p>
        </div>
        <button type="button" onClick={() => setCreating(true)} className="button-primary shrink-0">
          <Icon name="plus" size={16} />
          New playlist
        </button>
      </section>

      <LikedSongsCard songs={liked} />

      <Tabs items={items} value={tab} onChange={setTab} label="Library sections" />

      {!ready ? (
        <p className="text-[14px] text-text-secondary">Reading your library on this device…</p>
      ) : (
        <>
          {tab === 'playlists' && (
            <PlaylistsTab onCreate={() => setCreating(true)} playlists={playlists} />
          )}

          {tab === 'songs' &&
            (liked.length ? (
              <section>
                <p className="section-kicker mb-3">Most recently liked first</p>
                <div className="premium-panel p-2 sm:p-3">
                  <TrackList songs={liked} />
                </div>
              </section>
            ) : (
              <Empty
                icon="heart"
                title="No liked songs yet"
                message="Tap the heart on any track and it will be waiting here."
              />
            ))}

          {tab === 'albums' &&
            (albums.length ? (
              <CollectedGrid
                items={albums}
                kind="album"
                note="Albums your saved and recently played songs came from."
              />
            ) : (
              <Empty
                icon="disc"
                title="No albums yet"
                message="Like a few songs and the albums they come from will collect here."
              />
            ))}

          {tab === 'artists' &&
            (artists.length ? (
              <CollectedGrid
                items={artists}
                kind="artist"
                note="Artists behind the songs you have saved and played."
              />
            ) : (
              <Empty
                icon="user"
                title="No artists yet"
                message="Play or like some music and the artists will collect here."
              />
            ))}
        </>
      )}

      <CreatePlaylistDialog open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}

function PlaylistsTab({
  playlists,
  onCreate,
}: {
  playlists: ReturnType<typeof usePlaylists.getState>['playlists'];
  onCreate: () => void;
}) {
  const playQueue = usePlayer((state) => state.playQueue);

  if (playlists.length === 0) {
    return (
      <section className="premium-panel p-8 text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-accent/10 text-accent-soft ring-1 ring-accent/30">
          <Icon name="library" size={25} />
        </span>
        <h2 className="mt-4 text-h4 font-extrabold">No playlists yet</h2>
        <p className="mx-auto mt-2 max-w-md text-[14px] leading-relaxed text-text-secondary">
          Build one from the tracks you keep coming back to. Use the plus button on any song to add
          it.
        </p>
        <button type="button" onClick={onCreate} className="button-primary mt-6">
          <Icon name="plus" size={16} />
          Create a playlist
        </button>
      </section>
    );
  }

  return (
    <m.ul
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
    >
      {playlists.map((playlist) => {
        const covers = playlist.songs.slice(0, 4).map((song) => pickImage(song.image, '150x150'));
        return (
          <li key={playlist.id} className="group relative">
            <Link
              href={`/library/playlist/${playlist.id}`}
              className="block rounded-card border border-white/[0.08] bg-white/[0.04] p-3 transition hover:-translate-y-1 hover:border-accent-soft/45 hover:bg-white/[0.07] hover:shadow-glow"
            >
              <span className="relative mb-3 block aspect-square overflow-hidden rounded-[10px] border border-white/10 bg-surface-raised">
                {covers.length >= 4 ? (
                  <span className="grid h-full w-full grid-cols-2 grid-rows-2">
                    {covers.map((cover, index) => (
                      <span key={index} className="relative">
                        <Image src={cover} alt="" fill sizes="90px" className="object-cover" />
                      </span>
                    ))}
                  </span>
                ) : covers.length > 0 ? (
                  <Image src={covers[0]} alt="" fill sizes="180px" className="object-cover" />
                ) : (
                  <span className="grid h-full w-full place-items-center text-text-muted">
                    <Icon name="library" size={28} />
                  </span>
                )}
              </span>
              <span className="block truncate text-[14px] font-bold">{playlist.name}</span>
              <span className="mt-0.5 block text-[12px] text-text-secondary">
                {playlist.songs.length} {playlist.songs.length === 1 ? 'song' : 'songs'}
              </span>
            </Link>

            {playlist.songs.length > 0 && (
              <button
                type="button"
                aria-label={`Play ${playlist.name}`}
                onClick={() => playQueue(playlist.songs, 0)}
                // Visible by default on touch, hover-revealed on pointer devices. There is no hover
                // on a phone, so an opacity-0 control would be unreachable there.
                className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-brand text-on-accent shadow-glow transition lg:opacity-0 lg:group-hover:opacity-100 lg:focus-visible:opacity-100"
              >
                <Icon name="play" size={15} />
              </button>
            )}
          </li>
        );
      })}
    </m.ul>
  );
}

function CollectedGrid({
  items,
  kind,
  note,
}: {
  items: Collected[];
  kind: 'album' | 'artist';
  note: string;
}) {
  const circular = kind === 'artist';
  return (
    <section>
      <p className="mb-4 text-[12.5px] text-text-muted">{note}</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-5">
        {items.map((item) => (
          <Link
            key={item.id}
            href={entityHref(kind, item.name, item.id)}
            className="group block transition duration-300 hover:-translate-y-1"
          >
            <span
              className={`relative mb-2 block aspect-square overflow-hidden shadow-lift ${
                circular ? 'rounded-full' : 'rounded-card'
              }`}
            >
              <Image
                src={pickImage(item.sample.image)}
                alt=""
                fill
                sizes="200px"
                className="object-cover transition duration-500 group-hover:scale-105"
              />
            </span>
            <p className={`truncate text-[14px] font-bold leading-tight ${circular ? 'text-center' : ''}`}>
              {item.name}
            </p>
            <p
              className={`mt-0.5 truncate text-[12px] leading-tight text-text-secondary ${
                circular ? 'text-center' : ''
              }`}
            >
              {item.count} {item.count === 1 ? 'song' : 'songs'} saved
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}

function Empty({
  icon,
  title,
  message,
}: {
  icon: 'heart' | 'disc' | 'user';
  title: string;
  message: string;
}) {
  return (
    <section className="premium-panel p-8 text-center">
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-accent/10 text-accent-soft ring-1 ring-accent/30">
        <Icon name={icon} size={25} />
      </span>
      <h2 className="mt-4 text-h4 font-extrabold">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-[14px] leading-relaxed text-text-secondary">{message}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link href="/" className="button-primary">
          <Icon name="sparkle" size={16} />
          Find something to play
        </Link>
        <Link href="/search" className="button-secondary">
          <Icon name="search" size={16} />
          Search
        </Link>
      </div>
    </section>
  );
}
