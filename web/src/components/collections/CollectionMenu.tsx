'use client';

import type { Song } from '@/lib/types';
import { Menu, type MenuItem } from '@/components/ui/Menu';
import { usePlayer } from '@/stores/player';
import { notify } from '@/stores/toast';
import { shareLink } from '@/lib/share';

/**
 * Overflow actions for a collection header. Queue actions appear only when the
 * collection actually has playable tracks, and callers can append their own
 * entries such as rename or delete for a local playlist.
 */
export function CollectionMenu({
  title,
  path,
  songs,
  extraItems = [],
}: {
  title: string;
  path: string;
  songs: Song[];
  extraItems?: MenuItem[];
}) {
  const addToQueue = usePlayer((s) => s.addToQueue);

  const items: MenuItem[] = [];

  if (songs.length) {
    items.push({
      label: 'Add all to queue',
      icon: 'plus',
      onSelect: () => {
        songs.forEach((song) => addToQueue(song));
        notify(`Added ${songs.length} ${songs.length === 1 ? 'track' : 'tracks'} to queue`);
      },
    });
  }

  items.push({
    label: 'Share',
    icon: 'share',
    separated: items.length > 0,
    onSelect: () => void shareLink(path, title),
  });

  return <Menu items={[...items, ...extraItems]} label={`More options for ${title}`} />;
}
