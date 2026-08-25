import Link from 'next/link';
import type { Row, Song } from '@/lib/types';
import { MediaCard } from '@/components/cards/MediaCard';
import { Icon } from '@/components/ui/Icon';
import { isSong } from '@/lib/utils';

export function Carousel({ row }: { row: Row }) {
  if (!row.items?.length) return null;
  const songContext: Song[] | undefined =
    row.kind === 'songs' ? (row.items.filter(isSong) as Song[]) : undefined;

  return (
    <section>
      <div className="mb-3 flex items-end gap-3">
        <div className="min-w-0">
          <h2 className="truncate section-title">{row.title}</h2>
          {row.subtitle && <p className="mt-1 truncate text-sm text-text-secondary">{row.subtitle}</p>}
        </div>
        {row.showAll && (
          <Link
            href={row.showAll}
            className="ml-auto flex shrink-0 items-center gap-0.5 text-sm font-semibold text-text-secondary transition-colors hover:text-white"
          >
            See all
            <Icon name="chevronRight" size={15} />
          </Link>
        )}
      </div>

      <div className="no-scrollbar -mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        {row.items.map((item) => (
          <div key={item.id} className="w-36 shrink-0 snap-start sm:w-40 lg:w-44">
            <MediaCard item={item} context={songContext} />
          </div>
        ))}
      </div>
    </section>
  );
}
