'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { usePlaylists } from '@/stores/playlists';
import { TrackList } from '@/components/sections/TrackList';
import { CollectionActions } from '@/components/player/CollectionActions';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/Icon';

/**
 * One of the listener's own playlists.
 *
 * Lives on this device, so it is read after mount and the page has to hold a
 * neutral shape until then: an unhydrated store looks exactly like a playlist
 * that does not exist, and rendering "not found" in that gap would flash on every
 * visit.
 */
export function PlaylistExperience({ id }: { id: string }) {
  const router = useRouter();
  const hydrate = usePlaylists((s) => s.hydrate);
  const hydrated = usePlaylists((s) => s.hydrated);
  const playlist = usePlaylists((s) => s.playlists.find((p) => p.id === id));
  const rename = usePlaylists((s) => s.rename);
  const remove = usePlaylists((s) => s.remove);
  const removeSong = usePlaylists((s) => s.removeSong);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  if (!hydrated) {
    return (
      <div className="app-page">
        <p className="text-[13px] text-text-secondary">Opening your playlist…</p>
      </div>
    );
  }

  if (!playlist) {
    return (
      <div className="app-page">
        <EmptyState
          title="That playlist is not on this device"
          message="Playlists are stored per browser, so one made elsewhere will not appear here."
          ctaHref="/library"
          ctaLabel="Back to your space"
        />
      </div>
    );
  }

  function commitRename() {
    rename(playlist!.id, draft);
    setEditing(false);
  }

  function deletePlaylist() {
    if (!window.confirm(`Delete “${playlist!.name}”? The tracks stay in the catalogue.`)) return;
    remove(playlist!.id);
    router.push('/library');
  }

  return (
    <div className="app-page">
      <section className="disco-panel p-6 sm:p-8">
        <p className="section-kicker">Your playlist</p>

        {editing ? (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitRename();
                if (e.key === 'Escape') setEditing(false);
              }}
              maxLength={60}
              aria-label="Playlist name"
              className="min-w-0 flex-1 rounded-xl border border-white/15 bg-black/25 px-3 py-2 text-h4 font-extrabold outline-none focus:border-fuchsia-300/60"
            />
            <button type="button" onClick={commitRename} className="button-primary">
              <Icon name="check" size={15} />
              Save
            </button>
            <button type="button" onClick={() => setEditing(false)} className="button-secondary">
              Cancel
            </button>
          </div>
        ) : (
          <h1 className="mt-2 text-h2 font-extrabold tracking-[-0.04em] sm:text-h1">
            {playlist.name}
            <span className="headline-gradient">.</span>
          </h1>
        )}

        <p className="mt-3 text-[15px] text-white/70">
          {playlist.songs.length} {playlist.songs.length === 1 ? 'track' : 'tracks'}, kept on this
          device.
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <CollectionActions songs={playlist.songs} />
          {!editing && (
            <button
              type="button"
              onClick={() => {
                setDraft(playlist.name);
                setEditing(true);
              }}
              className="button-secondary"
            >
              <Icon name="pencil" size={15} />
              Rename
            </button>
          )}
          <button type="button" onClick={deletePlaylist} className="button-secondary">
            <Icon name="trash" size={15} />
            Delete
          </button>
        </div>
      </section>

      {playlist.songs.length ? (
        <section>
          <div className="mb-4">
            <p className="section-kicker mb-1">In order added</p>
            <h2 className="section-title">Tracks</h2>
          </div>
          <div className="premium-panel p-2 sm:p-3">
            <TrackList
              songs={playlist.songs}
              onRemove={(song) => removeSong(playlist.id, song.id)}
            />
          </div>
        </section>
      ) : (
        <section className="premium-panel mx-auto flex w-full max-w-2xl flex-col items-center p-8 text-center sm:p-12">
          <span className="grid h-16 w-16 place-items-center rounded-full bg-fuchsia-400/10 text-accent-soft ring-1 ring-fuchsia-300/30">
            <Icon name="playlistAdd" size={26} />
          </span>
          <h2 className="mt-5 text-h4 font-extrabold">Nothing in here yet</h2>
          <p className="mt-2 max-w-lg text-[14px] leading-relaxed text-text-secondary">
            Use the playlist button on any track to add it.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/search" className="button-primary">
              <Icon name="search" size={16} />
              Find a track
            </Link>
            <Link href="/explore" className="button-secondary">
              <Icon name="sparkle" size={16} />
              Explore music
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
