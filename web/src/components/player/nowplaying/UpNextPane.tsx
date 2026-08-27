'use client';

import Image from 'next/image';
import { usePlayer } from '@/stores/player';
import { artistLine, formatDuration, pickImage } from '@/lib/utils';
import { Icon } from '@/components/ui/Icon';

/**
 * The remainder of the queue, inside the player.
 *
 * This is the "queue management without leaving the player" part of the brief. It is a separate
 * component from the existing `QueuePanel` overlay on purpose: on desktop the queue lives in the
 * right-hand pane of the two-column player, where an overlay sliding over the top of the player
 * that opened it would be an odd stack of two modals.
 *
 * Remember the queue model when reading this: `order` holds indices *into* `queue`, so a row
 * needs both its position in `order` (to play it) and its natural queue index (to remove it).
 * Mixing the two up is the easiest bug to introduce here, which is why both are carried
 * explicitly rather than recomputed at the call site.
 */
export function UpNextPane() {
  const queue = usePlayer((state) => state.queue);
  const order = usePlayer((state) => state.order);
  const orderPos = usePlayer((state) => state.orderPos);
  const playAt = usePlayer((state) => state.playAt);
  const removeFromQueue = usePlayer((state) => state.removeFromQueue);
  const clearQueue = usePlayer((state) => state.clearQueue);

  const upcoming = order
    .slice(orderPos + 1)
    .map((queueIndex, offset) => ({
      queueIndex,
      orderPos: orderPos + 1 + offset,
      song: queue[queueIndex],
    }))
    // A missing song means the arrays disagreed, which should not happen but would crash the
    // row rather than degrade if it did.
    .filter((entry) => !!entry.song);

  if (upcoming.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-white/[0.07] text-text-secondary">
          <Icon name="queue" size={22} />
        </span>
        <p className="text-h5 font-bold">Nothing up next</p>
        <p className="max-w-xs text-[13px] leading-relaxed text-text-secondary">
          When this track ends, playback stops. Start a station or open an album to keep going.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto px-2 py-3 sm:px-4">
      <div className="mb-2 flex items-center justify-between px-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-text-muted">
          {upcoming.length} up next
        </p>
        <button
          type="button"
          onClick={clearQueue}
          className="text-[12px] font-bold text-accent-soft transition hover:text-white"
        >
          Clear
        </button>
      </div>

      <ul className="flex flex-col">
        {upcoming.map(({ song, orderPos: pos, queueIndex }) => (
          <li key={`${queueIndex}-${song.id}`} className="group flex items-center gap-3 rounded-card p-1.5 transition hover:bg-white/[0.06]">
            <button
              type="button"
              onClick={() => playAt(pos)}
              aria-label={`Play ${song.name}`}
              className="relative h-11 w-11 shrink-0 overflow-hidden rounded-[9px] border border-white/10"
            >
              <Image src={pickImage(song.image, '150x150')} alt="" fill sizes="44px" className="object-cover" />
              <span className="absolute inset-0 grid place-items-center bg-black/50 opacity-0 transition group-hover:opacity-100">
                <Icon name="play" size={15} />
              </span>
            </button>

            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-bold leading-tight">{song.name}</p>
              <p className="mt-0.5 truncate text-[11.5px] leading-tight text-text-secondary">
                {artistLine(song)}
              </p>
            </div>

            <span className="shrink-0 text-[11px] tabular-nums text-text-muted">
              {formatDuration(song.duration ?? 0)}
            </span>

            <button
              type="button"
              aria-label={`Remove ${song.name} from the queue`}
              // Takes the natural queue index, not the order position. The store refuses to
              // remove the currently playing track, and only upcoming rows are listed here
              // anyway, so this can never target it.
              onClick={() => removeFromQueue(queueIndex)}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-text-muted transition hover:bg-white/10 hover:text-white lg:opacity-0 lg:group-hover:opacity-100 lg:focus-visible:opacity-100"
            >
              <Icon name="close" size={15} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
