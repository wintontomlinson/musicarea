import Link from 'next/link';
import type { Row } from '@/lib/types';
import { MediaCard } from '@/components/cards/MediaCard';
import { Icon } from '@/components/ui/Icon';

/**
 * A titled horizontal carousel of media cards. On desktop it scrolls sideways;
 * on mobile it stays swipeable. The header keeps its optional "See all" link on
 * one line beside a truncating title.
 */
export function Carousel({ row }: { row: Row }) {
  if (!row.items?.length) return null;
  return (
    <section className="animate-fade-up">
      <div className="mb-3 flex items-end gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-h4 font-extrabold tracking-tight">{row.title}</h2>
          {row.subtitle && (
            <p className="mt-0.5 truncate text-sm text-text-secondary">{row.subtitle}</p>
          )}
        </div>
        {row.showAll && (
          <Link
            href={row.showAll}
            className="ml-auto flex shrink-0 items-center gap-1 whitespace-nowrap text-sm font-semibold text-accent hover:text-accent-soft"
          >
            See All
            <Icon name="chevronRight" size={14} />
          </Link>
        )}
      </div>

      <div className="no-scrollbar -mx-2 flex snap-x gap-1 overflow-x-auto px-2 pb-2">
        {row.items.map((item) => (
          <div key={item.id} className="w-40 shrink-0 snap-start sm:w-44">
            <MediaCard item={item} />
          </div>
        ))}
      </div>
    </section>
  );
}
