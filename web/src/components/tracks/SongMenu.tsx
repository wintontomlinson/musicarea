'use client';

import type { Song } from '@/lib/types';
import { Menu, type MenuItem } from '@/components/ui/Menu';
import { usePlayer } from '@/stores/player';
import { useLibrary } from '@/stores/library';
import { useUi } from '@/stores/ui';
import { notify } from '@/stores/toast';
import { shareLink } from '@/lib/share';
import { artistLine, entityHref, primaryArtist } from '@/lib/utils';

/**
 * Per-track action menu.
 *
 * Only applicable actions are listed: artist and album entries appear when the
 * catalogue actually provides those ids, and a removal action appears only where
 * the caller can remove the track from something.
 */
export function SongMenu({
  song,
  onRemove,
  removeLabel = 'Remove',
}: {
  song: Song;
  onRemove?: () => void;
  removeLabel?: string;
}) {
  const playNow = usePlayer((s) => s.playNow);
  const playNext = usePlayer((s) => s.playNext);
  const addToQueue = usePlayer((s) => s.addToQueue);
  const liked = useLibrary((s) => s.songs.some((entry) => entry.id === song.id));
  const toggleFavorite = useLibrary((s) => s.toggleFavoriteSong);
  const openAddToPlaylist = useUi((s) => s.openAddToPlaylist);

  const artist = primaryArtist(song);
  const songHref = entityHref('song', song.name, song.id);

  const items: MenuItem[] = [
    { label: 'Play now', icon: 'play', onSelect: () => playNow(song) },
    {
      label: 'Play next',
      icon: 'queue',
      onSelect: () => {
        playNext(song);
        notify(`Playing next: ${song.name}`);
      },
    },
    {
      label: 'Add to queue',
      icon: 'plus',
      onSelect: () => {
        addToQueue(song);
        notify('Added to queue');
      },
    },
    {
      label: liked ? 'Remove from Liked Songs' : 'Add to Liked Songs',
      icon: liked ? 'heart' : 'heartOutline',
      separated: true,
      onSelect: () => {
        const added = toggleFavorite(song);
        notify(added ? 'Added to Liked Songs' : 'Removed from Liked Songs');
      },
    },
    {
      label: 'Add to playlist',
      icon: 'playlist',
      onSelect: () => openAddToPlaylist([song]),
    },
  ];

  if (artist?.id) {
    items.push({
      label: 'Go to artist',
      icon: 'user',
      href: entityHref('artist', artist.name, artist.id),
      separated: true,
    });
  }
  if (song.album?.id && song.album.name) {
    items.push({
      label: 'Go to album',
      icon: 'disc',
      href: entityHref('album', song.album.name, song.album.id),
      separated: !artist?.id,
    });
  }

  items.push({
    label: 'Share',
    icon: 'share',
    separated: true,
    onSelect: () => void shareLink(songHref, `${song.name} by ${artistLine(song)}`),
  });

  if (onRemove) {
    items.push({
      label: removeLabel,
      icon: 'trash',
      danger: true,
      separated: true,
      onSelect: onRemove,
    });
  }

  return <Menu items={items} label={`More options for ${song.name}`} />;
}
