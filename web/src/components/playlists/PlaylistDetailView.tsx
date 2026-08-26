'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLibrary } from '@/stores/library';
import { DetailHeader } from '@/components/sections/DetailHeader';
import { TrackList } from '@/components/sections/TrackList';
import { CollectionActions } from '@/components/player/CollectionActions';
import { EmptyState } from '@/components/ui/EmptyState';
import { DetailHeaderSkeleton, TrackListSkeleton } from '@/components/ui/Skeleton';
import { Modal } from '@/components/ui/Modal';
import { Menu } from '@/components/ui/Menu';
import { formatDuration, pickImage, relativeTime } from '@/lib/utils';
import { notify } from '@/stores/toast';
import { shareLink } from '@/lib/share';

/**
 * A playlist that lives on this device: rename, edit the description, reorder,
 * remove tracks or delete it outright.
 *
 * Reordering is exposed through each row's menu rather than drag only, so it
 * works from the keyboard and on touch without a long-press gesture.
 */
export function PlaylistDetailView({ id }: { id: string }) {
  const router = useRouter();
  const hydrated = useLibrary((s) => s.hydrated);
  const playlist = useLibrary((s) => s.playlists.find((entry) => entry.id === id));
  const updatePlaylist = useLibrary((s) => s.updatePlaylist);
  const deletePlaylist = useLibrary((s) => s.deletePlaylist);
  const removeFromPlaylist = useLibrary((s) => s.removeFromPlaylist);

  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  if (!hydrated) {
    return (
      <div className="page page-stack">
        <DetailHeaderSkeleton />
        <TrackListSkeleton rows={6} />
      </div>
    );
  }

  if (!playlist) {
    return (
      <div className="page page-stack">
        <EmptyState
          icon="playlist"
          title="Playlist not found"
          message="This playlist is not stored on this device. It may have been deleted, or created in another browser."
          ctaHref="/playlists"
          ctaLabel="Your playlists"
        />
      </div>
    );
  }

  const songs = playlist.songs;
  const totalSeconds = songs.reduce((sum, song) => sum + (song.duration || 0), 0);
  const cover = songs[0] ? pickImage(songs[0].image) : pickImage(undefined);

  function openEditor() {
    setName(playlist!.name);
    setDescription(playlist!.description ?? '');
    setEditing(true);
  }

  return (
    <div className="page page-stack">
      <DetailHeader
        cover={cover}
        kind="Playlist on this device"
        title={playlist.name}
        description={playlist.description}
        meta={
          [
            `${songs.length} ${songs.length === 1 ? 'track' : 'tracks'}`,
            totalSeconds ? formatDuration(totalSeconds) : null,
            `Updated ${relativeTime(playlist.updatedAt)}`,
          ]
            .filter(Boolean)
            .join(' · ')
        }
        priority={false}
        actions={
          <>
            <CollectionActions songs={songs} />
            <Menu
              label={`Options for ${playlist.name}`}
              items={[
                { label: 'Edit details', icon: 'edit', onSelect: openEditor },
                {
                  label: 'Share',
                  icon: 'share',
                  onSelect: () => void shareLink(`/playlists/${playlist.id}`, playlist.name),
                },
                {
                  label: 'Delete playlist',
                  icon: 'trash',
                  danger: true,
                  separated: true,
                  onSelect: () => setConfirmDelete(true),
                },
              ]}
            />
          </>
        }
      />

      {songs.length ? (
        <TrackList
          songs={songs}
          onRemove={(song) => {
            removeFromPlaylist(playlist.id, song.id);
            notify(`Removed ${song.name}`);
          }}
          removeLabel="Remove from this playlist"
        />
      ) : (
        <EmptyState
          icon="playlist"
          title="This playlist is empty"
          message="Use Add to playlist from any song menu to fill it."
          ctaHref="/search"
          ctaLabel="Find songs"
        />
      )}

      <Modal
        open={editing}
        onClose={() => setEditing(false)}
        title="Edit playlist"
        footer={
          <>
            <button type="button" onClick={() => setEditing(false)} className="btn-secondary">
              Cancel
            </button>
            <button
              type="button"
              disabled={!name.trim()}
              onClick={() => {
                updatePlaylist(playlist.id, { name, description });
                setEditing(false);
                notify('Playlist updated');
              }}
              className="btn-primary"
            >
              Save
            </button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div>
            <label htmlFor="edit-name" className="mb-2 block text-meta text-text-secondary">
              Name
            </label>
            <input
              id="edit-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={80}
              className="field px-3.5 py-2.5"
            />
          </div>
          <div>
            <label htmlFor="edit-description" className="mb-2 block text-meta text-text-secondary">
              Description
            </label>
            <textarea
              id="edit-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={300}
              rows={3}
              className="field resize-none px-3.5 py-2.5"
            />
          </div>
        </div>
      </Modal>

      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={`Delete ${playlist.name}?`}
        description="The playlist is removed from this device. The songs themselves are not affected."
        footer={
          <>
            <button type="button" onClick={() => setConfirmDelete(false)} className="btn-secondary">
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                deletePlaylist(playlist.id);
                notify('Playlist deleted');
                router.push('/playlists');
              }}
              className="btn-primary"
            >
              Delete
            </button>
          </>
        }
      />
    </div>
  );
}
