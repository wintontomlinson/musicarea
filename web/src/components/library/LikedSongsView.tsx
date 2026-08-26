'use client';

import { useLibrary } from '@/stores/library';
import { useUi } from '@/stores/ui';
import { TrackList } from '@/components/sections/TrackList';
import { CollectionActions } from '@/components/player/CollectionActions';
import { EmptyState } from '@/components/ui/EmptyState';
import { TrackListSkeleton } from '@/components/ui/Skeleton';
import { Menu } from '@/components/ui/Menu';
import { formatDuration } from '@/lib/utils';
import { notify } from '@/stores/toast';

/**
 * Liked Songs. Backed entirely by on-device storage, newest first, so the list
 * reads as a record of what was saved most recently.
 */
export function LikedSongsView() {
  const hydrated = useLibrary((s) => s.hydrated);
  const songs = useLibrary((s) => s.songs);
  const toggleFavorite = useLibrary((s) => s.toggleFavoriteSong);
  const openAddToPlaylist = useUi((s) => s.openAddToPlaylist);

  const totalSeconds = songs.reduce((sum, song) => sum + (song.duration || 0), 0);

  return (
    <div className="page page-stack">
      <header>
        <p className="t-micro">Your collection</p>
        <h1 className="mt-2 t-display">Liked Songs</h1>
        {hydrated && songs.length > 0 && (
          <p className="mt-2.5 t-meta">
            {songs.length} {songs.length === 1 ? 'song' : 'songs'}
            {totalSeconds ? ` · ${formatDuration(totalSeconds)}` : ''}
          </p>
        )}

        {hydrated && songs.length > 0 && (
          <div className="mt-6">
            <CollectionActions songs={songs}>
              <Menu
                label="Liked songs options"
                items={[
                  {
                    label: 'Add all to a playlist',
                    icon: 'playlist',
                    onSelect: () => openAddToPlaylist(songs),
                  },
                ]}
              />
            </CollectionActions>
          </div>
        )}
      </header>

      {!hydrated ? (
        <TrackListSkeleton rows={8} />
      ) : songs.length ? (
        <TrackList
          songs={songs}
          onRemove={(song) => {
            toggleFavorite(song);
            notify('Removed from Liked Songs');
          }}
          removeLabel="Remove from Liked Songs"
        />
      ) : (
        <EmptyState
          icon="heartOutline"
          title="No liked songs yet"
          message="Tap the heart on any track and it will be saved here on this device."
          ctaHref="/explore"
          ctaLabel="Find music"
          secondaryHref="/charts"
          secondaryLabel="Browse charts"
        />
      )}
    </div>
  );
}
