'use client';

import { usePlayer } from '@/stores/player';
import { Icon } from '@/components/ui/Icon';
import type { Song } from '@/lib/types';

interface PlayButtonProps {
  song: Song;
  /** Sibling songs to play in context, starting from this one. */
  list?: Song[];
  className?: string;
  size?: number;
  label?: string;
}

/**
 * Circular play control for a specific song. Reflects and toggles playback when
 * that song is current, otherwise starts it in the supplied list context.
 */
export function PlayButton({ song, list, className = '', size = 16, label }: PlayButtonProps) {
  const currentId = usePlayer((s) => s.currentTrack()?.id);
  const isPlaying = usePlayer((s) => s.isPlaying);
  const toggle = usePlayer((s) => s.toggle);
  const playQueue = usePlayer((s) => s.playQueue);
  const playNow = usePlayer((s) => s.playNow);

  const isCurrent = currentId === song.id;
  const showPause = isCurrent && isPlaying;

  function onClick(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (isCurrent) {
      toggle();
      return;
    }
    if (list?.length) {
      playQueue(list, Math.max(0, list.findIndex((s) => s.id === song.id)));
    } else {
      playNow(song);
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label ?? (showPause ? `Pause ${song.name}` : `Play ${song.name}`)}
      className={`btn-play-light ${className}`}
    >
      <Icon name={showPause ? 'pause' : 'play'} size={size} />
    </button>
  );
}
