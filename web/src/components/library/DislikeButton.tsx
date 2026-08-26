'use client';

import { useState } from 'react';
import type { Song } from '@/lib/types';
import { useHistory } from '@/stores/history';
import { usePlayer } from '@/stores/player';
import { Icon } from '@/components/ui/Icon';

/**
 * "Not for me".
 *
 * The only negative signal a listener can give on purpose. It carries the
 * heaviest weight of any event (-2.4) and also adds the track to the recommender's
 * hard exclusion set, so a disliked song is dropped from candidates outright
 * rather than merely ranked down, and its artist is damped.
 *
 * Skipping on afterwards would double-count as a `skip`, so the track is left
 * playing and the listener can move on themselves. Only the acknowledgement
 * changes, which keeps the action honest about what it did.
 */
export function DislikeButton({ song, className = '' }: { song: Song; className?: string }) {
  const log = useHistory((s) => s.log);
  const repeat = usePlayer((s) => s.repeat);
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <span className={`text-[12px] font-semibold text-text-secondary ${className}`}>
        Noted. You will see less like that.
      </span>
    );
  }

  return (
    <button
      type="button"
      aria-label={`Show me less like ${song.name}`}
      title="Not for me"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        log(song, 'dislike');
        setDone(true);
        // Repeat-one would otherwise keep replaying a track just marked unwanted.
        if (repeat === 'one') usePlayer.getState().cycleRepeat();
      }}
      className={`grid place-items-center rounded-md text-text-muted transition-colors hover:text-white ${className}`}
    >
      <Icon name="thumbDown" size={16} />
    </button>
  );
}
