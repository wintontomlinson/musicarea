'use client';

import { useEffect, useState } from 'react';
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
  const [popping, setPopping] = useState(false);

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
        // Only celebrate on the way in. Playing the same overshoot when a song is
        // un-liked would read as confirmation of the wrong thing.
        if (!liked) setPopping(true);
        toggleLike(song);
      }}
      className={`grid place-items-center rounded-md transition-colors ${
        liked ? 'text-accent' : 'text-text-muted hover:text-white'
      } ${className}`}
    >
      {/* The animation is CSS rather than Framer because it is fire-and-forget and
          needs no gesture or layout tracking. `onAnimationEnd` clears the class so a
          second like re-triggers it; without that the animation would only ever
          play once per mount. */}
      <span
        className={popping ? 'animate-heart-pop' : undefined}
        onAnimationEnd={() => setPopping(false)}
      >
        <Icon name="heart" size={size} />
      </span>
    </button>
  );
}
