import Link from 'next/link';
import type { Row, Song } from '@/lib/types';
import { MediaCard } from '@/components/cards/MediaCard';
import { Icon } from '@/components/ui/Icon';
import { isSong } from '@/lib/utils';

/**
 * A horizontal discovery shelf: title, optional See all, then a snapping row of
 * cards that runs out to the page gutters so the content reads as continuing
 * past the edge of the viewport.
 */
export function Carousel({
  row,
  shape = 'square',
}: {
  row: Row;
  shape?: 'square' | 'circle';
}) {
  if (!row.items?.length) return null;

  // For song shelves the whole row becomes the play context.
  const songContext: Song[] | undefined =
    row.kind === 'songs' ? (row.items.filter(isSong) as Song[]) : undefined;

  return (
    <section aria-labelledby={`shelf-${row.id}`}>
      <div className="mb-4 flex items-end gap-4">
        <div className="min-w-0">
          <h2 id={`shelf-${row.id}`} className="truncate text-section">
            {row.title}
          </h2>
          {row.subtitle && <p className="mt-1 truncate t-meta">{row.subtitle}</p>}
        </div>
        {row.showAll && (
          <Link href={row.showAll} className="link-quiet ml-auto shrink-0">
            See all
            <Icon name="chevronRight" size={13} />
          </Link>
        )}
      </div>

      <div className="bleed-row no-scrollbar pb-1">
        {row.items.map((item) => (
          <div
            key={item.id}
            className="w-[150px] shrink-0 snap-start sm:w-[168px] lg:w-[184px]"
          >
            <MediaCard item={item} context={songContext} shape={shape} />
          </div>
        ))}
      </div>
    </section>
  );
}
