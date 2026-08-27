'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { usePlaylists } from '@/stores/playlists';
import { totalDuration } from '@/lib/stats';
import { formatDuration, pickImage } from '@/lib/utils';
import { Icon } from '@/components/ui/Icon';
import { TrackList } from '@/components/sections/TrackList';
import { CollectionActions } from '@/components/player/CollectionActions';

/**
 * One local playlist.
 *
 * A real route rather than an expanding panel in the Library, so a playlist can be linked to,
 * reached with the back button, and reloaded. It is a client component because the data only
 * exists in localStorage; the server has nothing to render.
 *
 * Three states matter and are deliberately distinguished: not yet hydrated, hydrated but no such
 * playlist, and found. Collapsing the first two would flash "playlist not found" on every load,
 * which is the most common bug in localStorage-backed routes.
 */
export function LocalPlaylistExperience({ id }: { id: string }) {
  const router = useRouter();
  const hydrate = usePlaylists((state) => state.hydrate);
  const hydrated = usePlaylists((state) => state.hydrated);
  // Subscribed to the list rather than calling `get`, so this re-renders when songs are added or
  // removed from elsewhere (the add-to-playlist picker in the player, for instance).
  const playlist = usePlaylists((state) => state.playlists.find((entry) => entry.id === id));
  const rename = usePlaylists((state) => state.rename);
  const remove = usePlaylists((state) => state.remove);
  const removeSong = usePlaylists((state) => state.removeSong);

  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState('');

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  if (!hydrated) {
    return (
      <div className="app-page">
        <p className="text-[14px] text-text-secondary">Opening your playlist…</p>
      </div>
    );
  }

  if (!playlist) {
    return (
      <div className="app-page">
        <section className="premium-panel p-8 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-white/[0.07] text-text-secondary">
            <Icon name="library" size={25} />
          </span>
          <h1 className="mt-4 text-h4 font-extrabold">Playlist not found</h1>
          <p className="mx-auto mt-2 max-w-md text-[14px] leading-relaxed text-text-secondary">
            Playlists are stored in the browser that created them, so this link will not open on
            another device, and it will be gone if the site data was cleared.
          </p>
          <Link href="/library" className="button-primary mt-6">
            <Icon name="library" size={16} />
            Back to your library
          </Link>
        </section>
      </div>
    );
  }

  const covers = playlist.songs.slice(0, 4).map((song) => pickImage(song.image, '150x150'));
  const totalSeconds = totalDuration(playlist.songs);

  function saveName() {
    rename(playlist!.id, draftName);
    setEditing(false);
  }

  function destroy() {
    if (!window.confirm(`Delete “${playlist!.name}”? This cannot be undone.`)) return;
    remove(playlist!.id);
    router.replace('/library');
  }

  return (
    <div className="app-page">
      <section className="disco-panel p-5 sm:p-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end">
          <span className="relative h-36 w-36 shrink-0 overflow-hidden rounded-card-lg border border-white/15 bg-surface-raised shadow-lift sm:h-44 sm:w-44">
            {covers.length >= 4 ? (
              <span className="grid h-full w-full grid-cols-2 grid-rows-2">
                {covers.map((cover, index) => (
                  <span key={index} className="relative">
                    <Image src={cover} alt="" fill sizes="88px" className="object-cover" />
                  </span>
                ))}
              </span>
            ) : covers.length > 0 ? (
              <Image src={covers[0]} alt="" fill sizes="176px" className="object-cover" />
            ) : (
              <span className="grid h-full w-full place-items-center text-text-muted">
                <Icon name="library" size={38} />
              </span>
            )}
          </span>

          <div className="min-w-0 flex-1">
            <p className="section-kicker">Playlist on this device</p>

            {editing ? (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  saveName();
                }}
                className="mt-2 flex flex-wrap items-center gap-2"
              >
                <input
                  autoFocus
                  value={draftName}
                  onChange={(event) => setDraftName(event.target.value)}
                  maxLength={60}
                  aria-label="Playlist name"
                  className="min-w-0 flex-1 rounded-card border border-white/15 bg-black/25 px-3 py-2 text-h4 font-extrabold outline-none focus:border-accent/60"
                />
                <button type="submit" className="button-primary shrink-0 px-4 py-2 text-[13px]">
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="button-secondary shrink-0 px-4 py-2 text-[13px]"
                >
                  Cancel
                </button>
              </form>
            ) : (
              <h1 className="mt-1.5 break-words font-display text-h2 font-extrabold tracking-[-0.04em] sm:text-h1">
                {playlist.name}
              </h1>
            )}

            <p className="mt-2 text-[13.5px] text-white/70">
              {playlist.songs.length} {playlist.songs.length === 1 ? 'song' : 'songs'}
              {totalSeconds > 0 && ` · ${formatDuration(totalSeconds)}`}
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              {playlist.songs.length > 0 && <CollectionActions songs={playlist.songs} />}
              {!editing && (
                <button
                  type="button"
                  onClick={() => {
                    setDraftName(playlist.name);
                    setEditing(true);
                  }}
                  className="button-secondary"
                >
                  <Icon name="gear" size={15} />
                  Rename
                </button>
              )}
              <button type="button" onClick={destroy} className="button-secondary">
                <Icon name="close" size={15} />
                Delete
              </button>
            </div>
          </div>
        </div>
      </section>

      {playlist.songs.length === 0 ? (
        <section className="premium-panel p-8 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-accent/10 text-accent-soft ring-1 ring-accent/30">
            <Icon name="plus" size={25} />
          </span>
          <h2 className="mt-4 text-h4 font-extrabold">Nothing in here yet</h2>
          <p className="mx-auto mt-2 max-w-md text-[14px] leading-relaxed text-text-secondary">
            Use the plus button on any track, or the add button in the full screen player, to put
            songs in this playlist.
          </p>
          <Link href="/search" className="button-primary mt-6">
            <Icon name="search" size={16} />
            Find songs
          </Link>
        </section>
      ) : (
        <section>
          {/* The playlist's own list, with a per-row remove that the shared TrackList has no
              concept of. TrackList handles playback, favouriting and queueing; membership of this
              playlist is specific to this screen, so the control lives here. */}
          <div className="premium-panel p-2 sm:p-3">
            <TrackList songs={playlist.songs} />
          </div>

          <details className="mt-4">
            <summary className="cursor-pointer text-[13px] font-bold text-accent-soft transition hover:text-white">
              Remove songs from this playlist
            </summary>
            <ul className="mt-3 flex flex-col gap-1">
              {playlist.songs.map((song) => (
                <li
                  key={song.id}
                  className="flex items-center gap-3 rounded-card p-2 transition hover:bg-white/[0.06]"
                >
                  <Image
                    src={pickImage(song.image, '150x150')}
                    alt=""
                    width={36}
                    height={36}
                    className="shrink-0 rounded-[8px] object-cover"
                  />
                  <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{song.name}</span>
                  <button
                    type="button"
                    aria-label={`Remove ${song.name} from ${playlist.name}`}
                    onClick={() => removeSong(playlist.id, song.id)}
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-text-muted transition hover:bg-white/10 hover:text-white"
                  >
                    <Icon name="close" size={15} />
                  </button>
                </li>
              ))}
            </ul>
          </details>
        </section>
      )}
    </div>
  );
}
