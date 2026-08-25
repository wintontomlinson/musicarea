'use client';

import { usePlayer } from '@/stores/player';
import { Icon } from '@/components/ui/Icon';
import type { Song } from '@/lib/types';

interface PlayButtonProps {
  song: Song;
  /** Optional list to play in context, with `song` as the start. */
  list?: Song[];
  className?: string;
  size?: number;
  variant?: 'overlay' | 'solid';
  label?: string;
}

/**
 * A play/pause control for a specific song. If that song is the current track
 * it reflects and toggles playback; otherwise it starts it (in the given list
 * context when provided, else as a single-track queue).
 */
export function PlayButton({
  song,
  list,
  className = '',
  size = 18,
  variant = 'overlay',
  label,
}: PlayButtonProps) {
  const currentId = usePlayer((s) => s.currentTrack()?.id);
  const isPlaying = usePlayer((s) => s.isPlaying);
  const toggle = usePlayer((s) => s.toggle);
  const playQueue = usePlayer((s) => s.playQueue);
  const playNow = usePlayer((s) => s.playNow);

  const isCurrent = currentId === song.id;
  const showPause = isCurrent && isPlaying;

  function onClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (isCurrent) {
      toggle();
      return;
    }
    if (list && list.length) {
      const start = Math.max(0, list.findIndex((s) => s.id === song.id));
      playQueue(list, start);
    } else {
      playNow(song);
    }
  }

  const base =
    variant === 'overlay'
      ? 'grid place-items-center rounded-full bg-white text-black shadow-lift'
      : 'grid place-items-center rounded-full bg-brand text-white shadow-glow';

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label ?? (showPause ? `Pause ${song.name}` : `Play ${song.name}`)}
      className={`${base} ${className}`}
    >
      <Icon name={showPause ? 'pause' : 'play'} size={size} />
    </button>
  );
}
