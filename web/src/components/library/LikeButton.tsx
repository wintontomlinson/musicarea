'use client';

import { useEffect } from 'react';
import type { Song } from '@/lib/types';
import { useLibrary } from '@/stores/library';
import { Icon } from '@/components/ui/Icon';

/**
 * Favourite toggle for a single song. Reads from the library store, which is
 * backed by localStorage.
 *
 * The store is hydrated on mount rather than at module scope so the server and
 * the first client render agree on an empty library; until `hydrated` flips, the
 * heart renders in its unfilled state.
 */
export function LikeButton({
  song,
  size = 16,
  className = '',
}: {
  song: Song;
  size?: number;
  className?: string;
}) {
  const hydrate = useLibrary((s) => s.hydrate);
  const toggleLike = useLibrary((s) => s.toggleLike);
  // Subscribe to the list itself: deriving the boolean here means the button
  // re-renders when this song's membership changes.
  const liked = useLibrary((s) => s.liked.some((entry) => entry.id === song.id));

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return (
    <button
      type="button"
      aria-pressed={liked}
      aria-label={liked ? `Remove ${song.name} from favourites` : `Add ${song.name} to favourites`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleLike(song);
      }}
      className={`grid place-items-center rounded-md transition-colors ${
        liked ? 'text-accent' : 'text-text-muted hover:text-white'
      } ${className}`}
    >
      <Icon name="heart" size={size} />
    </button>
  );
}
