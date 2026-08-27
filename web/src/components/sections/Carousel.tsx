import Link from 'next/link';
import type { Row, Song } from '@/lib/types';
import { MediaCard } from '@/components/cards/MediaCard';
import { Icon } from '@/components/ui/Icon';
import { isSong } from '@/lib/utils';

/**
 * A horizontally scrolling shelf of tiles.
 *
 * Scrolling is CSS `snap-x` with native overflow rather than a carousel library. It
 * gives correct touch momentum, keyboard scrolling and screen-reader order for free,
 * and it degrades to a plain scrollable row with no JavaScript at all. Arrow buttons
 * were considered and left out: they only help on desktop, where a trackpad already
 * scrolls horizontally, and they take space from the artwork on every breakpoint.
 *
 * The negative margins are what let the row bleed to the viewport edge while its first
 * tile stays aligned with the page gutter. Without them a scrolled row appears to stop
 * short of the screen edge, which reads as a layout bug rather than as a scrollable
 * region.
 */
export function Carousel({ row }: { row: Row }) {
  if (!row.items?.length) return null;

  // Songs get the whole row as playback context, so starting one continues into the
  // rest of the shelf instead of stopping after a single track.
  const songContext: Song[] | undefined =
    row.kind === 'songs' ? (row.items.filter(isSong) as Song[]) : undefined;

  return (
    <section>
      <div className="mb-4 flex items-end gap-3">
        <div className="min-w-0">
          <p className="section-kicker mb-1">{row.kind === 'songs' ? 'Tracks' : 'Collections'}</p>
          <h2 className="section-title truncate">{row.title}</h2>
          {row.subtitle && (
            <p className="mt-1 truncate text-[13px] text-text-secondary">{row.subtitle}</p>
          )}
        </div>
        {row.showAll && (
          <Link
            href={row.showAll}
            className="tint-chip ml-auto shrink-0 hover:bg-accent/20 hover:text-white"
          >
            See all <Icon name="chevronRight" size={13} />
          </Link>
        )}
      </div>

      <div className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-3 sm:-mx-8 sm:gap-4 sm:px-8 lg:-mx-10 lg:px-10">
        {row.items.map((item) => (
          <div
            key={item.id}
            className="w-[9.75rem] shrink-0 snap-start sm:w-[11rem] lg:w-[12.5rem]"
          >
            <MediaCard item={item} context={songContext} />
          </div>
        ))}
      </div>
    </section>
  );
}
