'use client';

import { useState } from 'react';
import Image from 'next/image';
import { usePlayer } from '@/stores/player';
import { artistLine, pickImage } from '@/lib/utils';
import { Icon } from '@/components/ui/Icon';

/**
 * Slide-in queue panel. Lists the current track and what is coming up in play
 * order. Upcoming rows can be dragged to reorder (HTML5 DnD on pointer devices);
 * each maps back to its natural queue index so reordering survives shuffle.
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

  if (!open) return null;

  const currentQueueIndex = order[orderPos];
  const current = queue[currentQueueIndex];
  // Upcoming = order positions after the current one.
  const upcoming = order.slice(orderPos + 1).map((qi, i) => ({
    queueIndex: qi,
    orderPos: orderPos + 1 + i,
    song: queue[qi],
  }));

  function onDrop(targetQueueIndex: number) {
    if (dragFrom !== null && dragFrom !== targetQueueIndex) {
      reorderQueue(dragFrom, targetQueueIndex);
    }
    setDragFrom(null);
    setDragOver(null);
  }

  return (
    <>
      {/* Scrim */}
      <div
        className="fixed inset-0 z-[55] bg-black/50"
        onClick={() => setQueueOpen(false)}
        aria-hidden="true"
      />
      <aside
        aria-label="Play queue"
        className="fixed right-0 top-0 z-[56] flex h-full w-full max-w-sm flex-col border-l border-subtle bg-surface/95 backdrop-blur-glass"
      >
        <header className="flex items-center justify-between border-b border-subtle p-4">
          <h2 className="text-h5 font-extrabold">Queue</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={clearQueue}
              className="rounded-full px-3 py-1.5 text-xs font-semibold text-text-secondary hover:bg-white/5 hover:text-white"
            >
              Clear
            </button>
            <button
              type="button"
              aria-label="Close queue"
              onClick={() => setQueueOpen(false)}
              className="grid h-9 w-9 place-items-center rounded-full text-text-secondary hover:bg-white/5 hover:text-white"
            >
              <Icon name="close" size={18} />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-3">
          {current && (
            <>
              <p className="px-1 pb-2 text-xs font-bold uppercase tracking-wider text-text-secondary">
                Now Playing
              </p>
              <QueueRow song={current} active onClick={() => undefined} />
            </>
          )}

          {upcoming.length > 0 && (
            <p className="px-1 pb-2 pt-4 text-xs font-bold uppercase tracking-wider text-text-secondary">
              Next Up
            </p>
          )}

          {upcoming.map(({ song, queueIndex, orderPos: pos }) => (
            <div
              key={`${song.id}-${queueIndex}`}
              draggable
              onDragStart={() => setDragFrom(queueIndex)}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(queueIndex);
              }}
              onDrop={() => onDrop(queueIndex)}
              onDragEnd={() => {
                setDragFrom(null);
                setDragOver(null);
              }}
              className={dragOver === queueIndex ? 'rounded-lg ring-1 ring-accent/60' : ''}
            >
              <QueueRow
                song={song}
                draggable
                onClick={() => playAt(pos)}
                onRemove={() => removeFromQueue(queueIndex)}
              />
            </div>
          ))}

          {!current && (
            <p className="p-6 text-center text-sm text-text-secondary">The queue is empty.</p>
          )}
        </div>
      </aside>
    </>
  );
}

function QueueRow({
  song,
  active = false,
  draggable = false,
  onClick,
  onRemove,
}: {
  song: import('@/lib/types').Song;
  active?: boolean;
  draggable?: boolean;
  onClick: () => void;
  onRemove?: () => void;
}) {
  const cover = pickImage(song.image, '150x150');
  return (
    <div
      className={`group flex items-center gap-3 rounded-lg p-2 ${
        active ? 'bg-brand-soft' : 'hover:bg-white/5'
      }`}
    >
      {draggable && (
        <span className="cursor-grab text-text-muted" aria-hidden="true">
          <Icon name="drag" size={18} />
        </span>
      )}
      <button type="button" onClick={onClick} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded">
          <Image src={cover} alt="" fill sizes="40px" className="object-cover" />
        </span>
        <span className="min-w-0">
          <span className={`block truncate text-sm font-semibold ${active ? 'text-accent' : ''}`}>
            {song.name}
          </span>
          <span className="block truncate text-xs text-text-secondary">{artistLine(song)}</span>
        </span>
      </button>
      {onRemove && (
        <button
          type="button"
          aria-label={`Remove ${song.name} from queue`}
          onClick={onRemove}
          className="text-text-muted opacity-0 transition-opacity duration-150 hover:text-white group-hover:opacity-100"
        >
          <Icon name="close" size={16} />
        </button>
      )}
    </div>
  );
}
