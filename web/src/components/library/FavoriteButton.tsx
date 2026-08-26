'use client';

import { useLibrary } from '@/stores/library';
import { notify } from '@/stores/toast';
import { Icon } from '@/components/ui/Icon';
import type { CollectionCard, Song } from '@/lib/types';

/**
 * Favourite toggle for a song.
 *
 * Optimistic by construction: the store writes synchronously to local storage,
 * so the icon reflects the new state on the same frame. The filled heart is one
 * of the few places the accent colour is used.
 */
export function FavoriteButton({
  song,
  size = 18,
  className = '',
}: {
  song: Song;
  size?: number;
  className?: string;
}) {
  const hydrated = useLibrary((s) => s.hydrated);
  const liked = useLibrary((s) => s.songs.some((entry) => entry.id === song.id));
  const toggle = useLibrary((s) => s.toggleFavoriteSong);

  return (
    <button
      type="button"
      disabled={!hydrated}
      aria-pressed={liked}
      aria-label={liked ? `Remove ${song.name} from liked songs` : `Like ${song.name}`}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        const added = toggle(song);
        notify(added ? 'Added to Liked Songs' : 'Removed from Liked Songs');
      }}
      className={`btn-icon ${liked ? 'text-accent hover:text-accent-soft' : ''} ${className}`}
    >
      <Icon name={liked ? 'heart' : 'heartOutline'} size={size} />
    </button>
  );
}

/**
 * Favourite toggle for an album, artist or playlist. Stores a light reference
 * rather than the whole collection, so the library stays small.
 */
export function CollectionFavoriteButton({
  card,
  label,
}: {
  card: CollectionCard | { id: string; name: string; type: 'album' | 'artist' | 'playlist'; image?: Song['image'] };
  label: string;
}) {
  const hydrated = useLibrary((s) => s.hydrated);
  const saved = useLibrary((s) => s.collections.some((entry) => entry.id === card.id));
  const toggle = useLibrary((s) => s.toggleFavoriteCollection);

  return (
    <button
      type="button"
      disabled={!hydrated}
      aria-pressed={saved}
      onClick={() => {
        const added = toggle(card as CollectionCard);
        notify(added ? `Saved ${label}` : `Removed ${label}`);
      }}
      className={saved ? 'btn-secondary border-transparent bg-accent/15 text-accent' : 'btn-secondary'}
    >
      <Icon name={saved ? 'heart' : 'heartOutline'} size={15} />
      {saved ? 'Saved' : 'Save'}
    </button>
  );
}
