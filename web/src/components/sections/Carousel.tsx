import Link from 'next/link';
import type { Row, Song } from '@/lib/types';
import { MediaCard } from '@/components/cards/MediaCard';
import { Icon } from '@/components/ui/Icon';
import { isSong } from '@/lib/utils';

export function Carousel({ row }: { row: Row }) {
  if (!row.items?.length) return null;
  const songContext: Song[] | undefined = row.kind === 'songs' ? (row.items.filter(isSong) as Song[]) : undefined;

  return (
    <section>
      <div className="mb-4 flex items-end gap-3">
        <div className="min-w-0">
          <h2 className="truncate section-title">{row.title}</h2>
          {row.subtitle && <p className="mt-1 truncate text-[13px] text-text-secondary">{row.subtitle}</p>}
        </div>
        {row.showAll && (
          <Link href={row.showAll} className="ml-auto inline-flex shrink-0 items-center gap-0.5 text-[13px] font-semibold text-text-secondary transition-colors hover:text-white">
            See all <Icon name="chevronRight" size={14} />
          </Link>
        )}
      </div>
      <div className="no-scrollbar -mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-3 sm:-mx-8 sm:px-8 lg:-mx-10 lg:px-10">
        {row.items.map((item) => <div key={item.id} className="w-[9.75rem] shrink-0 snap-start sm:w-[11rem] lg:w-[12.5rem]"><MediaCard item={item} context={songContext} /></div>)}
      </div>
    </section>
  );
}
