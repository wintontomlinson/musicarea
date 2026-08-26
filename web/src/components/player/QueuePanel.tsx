'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { usePlayer } from '@/stores/player';
import type { Song } from '@/lib/types';
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
  // The now-playing row used to render a focusable button wired to a no-op.
  // Toggling playback is the obvious thing for it to do.
  const toggle = usePlayer((s) => s.toggle);
  const reorderQueue = usePlayer((s) => s.reorderQueue);
  const removeFromQueue = usePlayer((s) => s.removeFromQueue);
  const clearQueue = usePlayer((s) => s.clearQueue);

  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  // Escape closes the panel. The scrim is click-to-dismiss but aria-hidden, so
  // without this there was no keyboard way out.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setQueueOpen(false);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, setQueueOpen]);

  if (!open) return null;

  const currentQueueIndex = order[orderPos];
  const current = queue[currentQueueIndex];
  // Upcoming = order positions after the current one. Rows whose song is missing
  // are dropped rather than rendered: an order entry pointing past the queue is
  // a bug worth surviving, not one worth crashing the whole panel over.
  const upcoming = order
    .slice(orderPos + 1)
    .map((qi, i) => ({
      queueIndex: qi,
      orderPos: orderPos + 1 + i,
      song: queue[qi],
    }))
    .filter((entry): entry is typeof entry & { song: Song } => Boolean(entry.song));

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
        className="fixed inset-0 z-[55] bg-[#090613]/75 backdrop-blur-sm"
        onClick={() => setQueueOpen(false)}
        aria-hidden="true"
      />
      <aside
        aria-label="Play queue"
        className="fixed right-0 top-0 z-[56] flex h-full w-full max-w-sm flex-col border-l border-fuchsia-300/20 bg-[#130b24]/95 shadow-[-20px_0_60px_-28px_rgba(255,59,191,.45)] backdrop-blur-xl"
      >
        <header className="flex items-center justify-between border-b border-subtle p-4">
          <h2 className="text-h5 font-extrabold tracking-tight">Playing next</h2>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={clearQueue}
              className="rounded-md px-2.5 py-1.5 text-[13px] font-medium text-accent transition-colors hover:bg-white/[0.08]"
            >
              Clear
            </button>
            <button
              type="button"
              aria-label="Close queue"
              onClick={() => setQueueOpen(false)}
              className="grid h-8 w-8 place-items-center rounded-md text-text-secondary transition-colors hover:bg-white/[0.08] hover:text-white"
            >
              <Icon name="close" size={17} />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-3">
          {current && (
            <>
              <p className="px-2 pb-2 text-[12px] font-semibold uppercase tracking-[0.06em] text-text-secondary">
                Now Playing
              </p>
              <QueueRow song={current} active onClick={toggle} />
            </>
          )}

          {upcoming.length > 0 && (
            <p className="px-2 pb-2 pt-5 text-[12px] font-semibold uppercase tracking-[0.06em] text-text-secondary">
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
              className={dragOver === queueIndex ? 'rounded-md ring-1 ring-accent' : ''}
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
            <p className="p-6 text-center text-[13px] text-text-secondary">The queue is empty.</p>
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
      className={`group flex items-center gap-2.5 rounded-md p-2 transition-colors ${
        active ? 'border border-fuchsia-300/20 bg-fuchsia-400/[0.09]' : 'border border-transparent hover:bg-white/[0.07]'
      }`}
    >
      {draggable && (
        <span className="cursor-grab text-text-muted" aria-hidden="true">
          <Icon name="drag" size={17} />
        </span>
      )}
      <button type="button" onClick={onClick} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl border border-white/10">
          <Image src={cover} alt="" fill sizes="44px" className="object-cover" />
        </span>
        <span className="min-w-0">
          <span
            className={`block truncate text-[14px] font-medium leading-tight ${
              active ? 'text-accent' : ''
            }`}
          >
            {song.name}
          </span>
          <span className="mt-0.5 block truncate text-[13px] leading-tight text-text-secondary">
            {artistLine(song)}
          </span>
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
