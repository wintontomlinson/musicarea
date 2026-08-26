'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useLibrary } from '@/stores/library';
import { EmptyState } from '@/components/ui/EmptyState';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { Modal } from '@/components/ui/Modal';
import { Icon } from '@/components/ui/Icon';
import { pickImage } from '@/lib/utils';
import { notify } from '@/stores/toast';

/**
 * Your playlists. Cover art is taken from the first track, because a playlist
 * built on this device has no artwork of its own and a generated pattern would
 * be decoration without meaning.
 */
export function PlaylistsView() {
  const hydrated = useLibrary((s) => s.hydrated);
  const playlists = useLibrary((s) => s.playlists);
  const createPlaylist = useLibrary((s) => s.createPlaylist);

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  function submit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    createPlaylist(trimmed, description);
    setName('');
    setDescription('');
    setCreating(false);
    notify(`Created ${trimmed}`);
  }

  return (
    <div className="page page-stack">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="t-micro">Your collection</p>
          <h1 className="mt-2 t-display">Playlists</h1>
          {hydrated && playlists.length > 0 && (
            <p className="mt-2.5 t-meta">{playlists.length} on this device</p>
          )}
        </div>
        <button type="button" onClick={() => setCreating(true)} className="btn-primary">
          <Icon name="plus" size={16} />
          New playlist
        </button>
      </header>

      {!hydrated ? (
        <div className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 4 }).map((_, index) => (
            <CardSkeleton key={index} />
          ))}
        </div>
      ) : playlists.length ? (
        <div className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
          {playlists.map((playlist) => {
            const cover = playlist.songs[0]?.image;
            return (
              <Link key={playlist.id} href={`/playlists/${playlist.id}`} className="group block">
                <span className="relative mb-3 block aspect-square overflow-hidden rounded bg-surface-raised shadow-art">
                  {cover ? (
                    <Image
                      src={pickImage(cover)}
                      alt=""
                      fill
                      sizes="(max-width: 640px) 45vw, 200px"
                      className="object-cover transition-transform duration-base ease-out group-hover:scale-[1.03]"
                    />
                  ) : (
                    <span className="grid h-full w-full place-items-center text-text-muted">
                      <Icon name="playlist" size={26} />
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
      ) : (
        <EmptyState
          icon="playlist"
          title="No playlists yet"
          message="Create a playlist and add tracks to it from any song menu."
          ctaLabel="New playlist"
          ctaHref="#"
        />
      )}

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="New playlist"
        description="Stored on this device."
        footer={
          <>
            <button type="button" onClick={() => setCreating(false)} className="btn-secondary">
              Cancel
            </button>
            <button type="button" onClick={submit} disabled={!name.trim()} className="btn-primary">
              Create
            </button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div>
            <label htmlFor="playlist-name" className="mb-2 block text-meta text-text-secondary">
              Name
            </label>
            <input
              id="playlist-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') submit();
              }}
              maxLength={80}
              placeholder="Late night drive"
              className="field px-3.5 py-2.5"
            />
          </div>
          <div>
            <label
              htmlFor="playlist-description"
              className="mb-2 block text-meta text-text-secondary"
            >
              Description (optional)
            </label>
            <textarea
              id="playlist-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={300}
              rows={3}
              className="field resize-none px-3.5 py-2.5"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
