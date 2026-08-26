'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import type { Song } from '@/lib/types';
import { usePlayer } from '@/stores/player';
import { artistLine, entityHref, formatDuration, pickImage } from '@/lib/utils';
import { Icon } from '@/components/ui/Icon';
import { Drawer } from '@/components/ui/Drawer';
import { Menu } from '@/components/ui/Menu';
import { EmptyState } from '@/components/ui/EmptyState';

/**
 * Queue drawer.
 *
 * Shows what is playing and what follows in play order. Upcoming rows can be
 * dragged to reorder on a pointer device, and every row also exposes move up and
 * move down in its menu so reordering is possible from the keyboard.
 *
 * Positions map back to the natural queue index, so reordering behaves correctly
 * while shuffle is on.
 */
export function QueuePanel() {
  const open = usePlayer((s) => s.queueOpen);
  const setQueueOpen = usePlayer((s) => s.setQueueOpen);
  const queue = usePlayer((s) => s.queue);
  const order = usePlayer((s) => s.order);
  const orderPos = usePlayer((s) => s.orderPos);
  const playAt = usePlayer((s) => s.playAt);
  const reorderQueue = usePlayer((s) => s.reorderQueue);
  const removeFromQueue = usePlayer((s) => s.removeFromQueue);
  const clearQueue = usePlayer((s) => s.clearQueue);

  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  const currentQueueIndex = order[orderPos];
  const current = queue[currentQueueIndex];
  const upcoming = order.slice(orderPos + 1).map((queueIndex, offset) => ({
    queueIndex,
    position: orderPos + 1 + offset,
    song: queue[queueIndex],
  }));

  function onDrop(targetQueueIndex: number) {
    if (dragFrom !== null && dragFrom !== targetQueueIndex) {
      reorderQueue(dragFrom, targetQueueIndex);
    }
    setDragFrom(null);
    setDragOver(null);
  }

  return (
    <Drawer
      open={open}
      onClose={() => setQueueOpen(false)}
      title="Queue"
      headerAction={
        upcoming.length > 0 ? (
          <button
            type="button"
            onClick={clearQueue}
            className="rounded-xs px-2.5 py-1.5 text-meta font-semibold text-text-secondary transition-colors duration-fast hover:bg-white/5 hover:text-text"
          >
            Clear
          </button>
        ) : undefined
      }
    >
      {!current ? (
        <EmptyState
          compact
          icon="queue"
          title="The queue is empty"
          message="Play something and the rest of the queue will appear here."
        />
      ) : (
        <div className="p-3">
          <p className="t-micro px-2 pb-2">Now playing</p>
          <QueueRow song={current} active />

          {upcoming.length > 0 && (
            <>
              <p className="t-micro px-2 pb-2 pt-6">
                Next up · {upcoming.length} {upcoming.length === 1 ? 'track' : 'tracks'}
              </p>

              {upcoming.map(({ song, queueIndex, position }, index) => (
                <div
                  key={`${song.id}-${queueIndex}`}
                  draggable
                  onDragStart={() => setDragFrom(queueIndex)}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDragOver(queueIndex);
                  }}
                  onDrop={() => onDrop(queueIndex)}
                  onDragEnd={() => {
                    setDragFrom(null);
                    setDragOver(null);
                  }}
                  className={
                    dragOver === queueIndex ? 'rounded-sm ring-1 ring-accent' : undefined
                  }
                >
                  <QueueRow
                    song={song}
                    draggable
                    onPlay={() => playAt(position)}
                    onRemove={() => removeFromQueue(queueIndex)}
                    onMoveUp={
                      index > 0
                        ? () => reorderQueue(queueIndex, upcoming[index - 1].queueIndex)
                        : undefined
                    }
                    onMoveDown={
                      index < upcoming.length - 1
                        ? () => reorderQueue(queueIndex, upcoming[index + 1].queueIndex)
                        : undefined
                    }
                  />
                </div>
              ))}
            </>
          )}

          {upcoming.length === 0 && (
            <p className="px-2 pt-6 text-meta text-text-muted">
              Nothing queued after this track.
            </p>
          )}
        </div>
      )}
    </Drawer>
  );
}

function QueueRow({
  song,
  active = false,
  draggable = false,
  onPlay,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  song: Song;
  active?: boolean;
  draggable?: boolean;
  onPlay?: () => void;
  onRemove?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}) {
  const cover = pickImage(song.image, '150x150');

  return (
    <div
      className={`row group flex items-center gap-2.5 p-2 ${active ? 'row-active' : 'row-idle'}`}
    >
      {draggable && (
        <span className="cursor-grab text-text-muted" aria-hidden="true">
          <Icon name="drag" size={16} />
        </span>
      )}

      <button
        type="button"
        onClick={onPlay}
        disabled={!onPlay}
        aria-label={onPlay ? `Play ${song.name}` : undefined}
        className="relative h-11 w-11 shrink-0 overflow-hidden rounded-sm bg-surface"
      >
        <Image src={cover} alt="" fill sizes="44px" className="object-cover" />
        {onPlay && (
          <span className="absolute inset-0 grid place-items-center bg-black/50 opacity-0 transition-opacity duration-fast group-hover:opacity-100">
            <Icon name="play" size={14} />
          </span>
        )}
      </button>

      <div className="min-w-0 flex-1">
        <Link
          href={entityHref('song', song.name, song.id)}
          className={`block truncate text-meta font-medium transition-colors duration-fast hover:underline ${
            active ? 'text-accent' : 'text-text'
          }`}
        >
          {song.name}
        </Link>
        <p className="mt-0.5 truncate text-micro text-text-secondary">{artistLine(song)}</p>
      </div>

      <span className="shrink-0 text-micro tabular-nums text-text-muted">
        {formatDuration(song.duration)}
      </span>

      {(onRemove || onMoveUp || onMoveDown) && (
        <Menu
          label={`Queue options for ${song.name}`}
          items={[
            ...(onMoveUp ? [{ label: 'Move up', icon: 'chevronUp' as const, onSelect: onMoveUp }] : []),
            ...(onMoveDown
              ? [{ label: 'Move down', icon: 'collapse' as const, onSelect: onMoveDown }]
              : []),
            ...(onRemove
              ? [
                  {
                    label: 'Remove from queue',
                    icon: 'trash' as const,
                    danger: true,
                    separated: Boolean(onMoveUp || onMoveDown),
                    onSelect: onRemove,
                  },
                ]
              : []),
          ]}
        />
      )}
    </div>
  );
}
