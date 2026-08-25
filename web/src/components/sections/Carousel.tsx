import Link from 'next/link';
import type { Row, Song } from '@/lib/types';
import { MediaCard } from '@/components/cards/MediaCard';
import { Icon } from '@/components/ui/Icon';
import { isSong } from '@/lib/utils';

/**
 * An Apple Music shelf: a bold title with a red "See All" link, then a
 * horizontally snapping row of cards that runs out to the page gutters.
 */
export function Carousel({ row }: { row: Row }) {
  if (!row.items?.length) return null;
  // For song rows the whole shelf becomes the play context, so pressing play on
  // any card queues the rest of the row from that point.
  const songContext: Song[] | undefined =
    row.kind === 'songs' ? (row.items.filter(isSong) as Song[]) : undefined;

  return (
    <section>
      <div className="mb-3 flex items-end gap-3">
        <div className="min-w-0">
          <h2 className="truncate section-title">{row.title}</h2>
          {row.subtitle && (
            <p className="mt-0.5 truncate text-[13px] text-text-secondary">{row.subtitle}</p>
          )}
        </div>
        {row.showAll && (
          <Link
            href={row.showAll}
            className="ml-auto flex shrink-0 items-center gap-0.5 text-[13px] font-medium text-accent transition-colors hover:text-accent-soft"
          >
            See All
            <Icon name="chevronRight" size={13} />
          </Link>
        )}
      </div>

      <div className="no-scrollbar -mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-1 sm:-mx-8 sm:px-8 lg:-mx-10 lg:px-10">
        {row.items.map((item) => (
          <div key={item.id} className="w-[9.5rem] shrink-0 snap-start sm:w-[11rem] lg:w-[12rem]">
            <MediaCard item={item} context={songContext} />
          </div>
        ))}
      </div>
    </section>
  );
}
