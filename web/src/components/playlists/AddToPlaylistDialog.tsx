'use client';

import { useState } from 'react';
import { useUi } from '@/stores/ui';
import { useLibrary } from '@/stores/library';
import { notify } from '@/stores/toast';
import { Modal } from '@/components/ui/Modal';
import { Icon } from '@/components/ui/Icon';

/**
 * Adds the pending selection to a playlist, or to a new one created on the spot.
 *
 * Mounted once in the shell and driven by the interface store, so any track row,
 * card or collection header can open it without prop plumbing.
 *
 * Duplicates are skipped by the store, and the result is reported honestly:
 * adding four tracks where two are already present says two were added.
 */
export function AddToPlaylistDialog() {
  const songs = useUi((s) => s.addToPlaylist);
  const close = useUi((s) => s.closeAddToPlaylist);
  const playlists = useLibrary((s) => s.playlists);
  const createPlaylist = useLibrary((s) => s.createPlaylist);
  const addToPlaylist = useLibrary((s) => s.addToPlaylist);

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');

  const open = Boolean(songs?.length);
  const count = songs?.length ?? 0;

  function reset() {
    setCreating(false);
    setName('');
  }

  function report(added: number, playlistName: string) {
    if (added === 0) {
      notify(count === 1 ? 'Already in that playlist' : 'Already in that playlist');
    } else {
      notify(`Added ${added} ${added === 1 ? 'track' : 'tracks'} to ${playlistName}`);
    }
    reset();
    close();
  }

  function addTo(id: string, playlistName: string) {
    if (!songs) return;
    report(addToPlaylist(id, songs), playlistName);
  }

  function createAndAdd() {
    if (!songs) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    const id = createPlaylist(trimmed);
    report(addToPlaylist(id, songs), trimmed);
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        reset();
        close();
      }}
      title="Add to playlist"
      description={count > 1 ? `${count} tracks selected` : undefined}
    >
      {creating ? (
        <div className="flex flex-col gap-4">
          <div>
            <label htmlFor="new-playlist-name" className="mb-2 block text-meta text-text-secondary">
              Playlist name
            </label>
            <input
              id="new-playlist-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') createAndAdd();
              }}
              maxLength={80}
              placeholder="Late night drive"
              className="field px-3.5 py-2.5"
            />
          </div>
          <div className="flex justify-end gap-2.5">
            <button type="button" onClick={() => setCreating(false)} className="btn-secondary">
              Back
            </button>
            <button
              type="button"
              onClick={createAndAdd}
              disabled={!name.trim()}
              className="btn-primary"
            >
              Create and add
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-1 pb-5">
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="flex items-center gap-3 rounded-sm px-2 py-2.5 text-left transition-colors duration-fast hover:bg-white/5"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-sm bg-accent/15 text-accent">
              <Icon name="plus" size={18} />
            </span>
            <span className="text-body font-semibold">New playlist</span>
          </button>

          {playlists.length > 0 && <div className="my-1.5 h-px bg-white/10" />}

          <div className="max-h-[46vh] overflow-y-auto">
            {playlists.map((playlist) => (
              <button
                key={playlist.id}
                type="button"
                onClick={() => addTo(playlist.id, playlist.name)}
                className="flex w-full items-center gap-3 rounded-sm px-2 py-2.5 text-left transition-colors duration-fast hover:bg-white/5"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-sm bg-white/5 text-text-secondary">
                  <Icon name="playlist" size={17} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body font-medium">{playlist.name}</span>
                  <span className="block text-micro text-text-muted">
                    {playlist.songs.length} {playlist.songs.length === 1 ? 'track' : 'tracks'}
                  </span>
                </span>
              </button>
            ))}
          </div>

          {playlists.length === 0 && (
            <p className="px-2 pt-2 text-meta text-text-muted">
              You have no playlists yet. Create one to get started.
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}
