'use client';

import { useEffect, useState } from 'react';
import type { Song } from '@/lib/types';
import { usePlaylists } from '@/stores/playlists';
import { Sheet } from '@/components/ui/Sheet';
import { Icon } from '@/components/ui/Icon';
import { CreatePlaylistDialog } from './CreatePlaylistDialog';

/**
 * Adds a song to a local playlist.
 *
 * This is what makes playlists a real feature rather than a container that can never be filled.
 * Without it the Library would offer playlist creation and then no way to put anything in one.
 *
 * The picker lists every playlist with its current membership shown, and toggles rather than only
 * adding: seeing that a song is already in a playlist, and being able to take it out from the same
 * place, is the difference between a picker and a one-way funnel.
 */
export function AddToPlaylistButton({
  song,
  size = 20,
  className = '',
}: {
  song: Song;
  size?: number;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const hydrate = usePlaylists((state) => state.hydrate);
  const playlists = usePlaylists((state) => state.playlists);
  const addSong = usePlaylists((state) => state.addSong);
  const removeSong = usePlaylists((state) => state.removeSong);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return (
    <>
      <button
        type="button"
        aria-label={`Add ${song.name} to a playlist`}
        title="Add to playlist"
        onClick={() => setOpen(true)}
        className={`grid place-items-center rounded-full text-white/75 transition hover:bg-white/10 hover:text-white ${className}`}
      >
        <Icon name="plus" size={size} />
      </button>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        label={`Add ${song.name} to a playlist`}
        placement="right"
        // Above the Now Playing takeover (z-50) and the queue panel (z-56), because this can be
        // opened from inside either of them.
        zClassName="z-[57]"
        className="glass-overlay flex h-full w-[min(92vw,26rem)] flex-col p-5"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-h4 font-extrabold">Add to playlist</h2>
            <p className="mt-0.5 truncate text-[13px] text-text-secondary">{song.name}</p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-text-secondary transition hover:bg-white/10 hover:text-white"
          >
            <Icon name="close" size={17} />
          </button>
        </div>

        <button
          type="button"
          onClick={() => setCreating(true)}
          className="mt-5 flex w-full items-center gap-3 rounded-card border border-dashed border-white/20 p-3 text-left transition hover:border-accent/50 hover:bg-white/[0.06]"
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-card bg-accent/15 text-accent-soft">
            <Icon name="plus" size={19} />
          </span>
          <span className="text-[14px] font-bold">New playlist</span>
        </button>

        <div className="mt-4 min-h-0 flex-1 overflow-y-auto">
          {playlists.length === 0 ? (
            <p className="px-1 text-[13px] leading-relaxed text-text-secondary">
              You have no playlists yet. Create one above and this song will be its first track.
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {playlists.map((playlist) => {
                const included = playlist.songs.some((entry) => entry.id === song.id);
                return (
                  <li key={playlist.id}>
                    <button
                      type="button"
                      // A toggle, and `aria-pressed` says so. A checkbox-styled row that only ever
                      // added would misrepresent what pressing it does.
                      aria-pressed={included}
                      onClick={() =>
                        included ? removeSong(playlist.id, song.id) : addSong(playlist.id, song)
                      }
                      className="flex w-full items-center gap-3 rounded-card p-2.5 text-left transition hover:bg-white/[0.06]"
                    >
                      <span
                        className={`grid h-9 w-9 shrink-0 place-items-center rounded-[8px] transition ${
                          included ? 'bg-brand text-on-accent' : 'bg-white/[0.08] text-text-secondary'
                        }`}
                      >
                        <Icon name={included ? 'check' : 'library'} size={16} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-semibold">{playlist.name}</span>
                        <span className="block truncate text-[11.5px] text-text-muted">
                          {playlist.songs.length} {playlist.songs.length === 1 ? 'song' : 'songs'}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </Sheet>

      {/* Creating from here immediately seeds the new playlist with this song, which is almost
          always the intent when you reach for "new playlist" from a track. */}
      <CreatePlaylistDialog
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(id) => addSong(id, song)}
      />
    </>
  );
}
