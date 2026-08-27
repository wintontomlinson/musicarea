'use client';

import { Chip } from '@/components/ui/Chip';
import { Icon } from '@/components/ui/Icon';

/**
 * Trending searches.
 *
 * There is no trending-queries endpoint in this API, and inventing a hardcoded list would mean
 * shipping suggestions that go stale the week after release. So these are derived on the server
 * from the catalogue's own trending shelf: the artists and titles currently being pushed
 * editorially for the listener's languages.
 *
 * That is a slightly different thing from "what people are searching for", and the heading says
 * "Trending now" rather than "Trending searches" for exactly that reason. It is real, current
 * data rather than a plausible-looking fiction.
 */
export function TrendingChips({
  queries,
  onPick,
}: {
  queries: string[];
  onPick: (query: string) => void;
}) {
  if (queries.length === 0) return null;

  return (
    <section aria-labelledby="trending-now">
      <h2 id="trending-now" className="mb-3 flex items-center gap-2 text-[13px] font-bold uppercase tracking-[0.12em] text-text-muted">
        <Icon name="chart" size={15} className="text-accent-soft" />
        Trending now
      </h2>
      <div className="flex flex-wrap gap-2">
        {queries.map((query) => (
          // Buttons rather than links: picking one fills the field and searches in place, which
          // keeps the listener in the flow of refining a query.
          <Chip key={query} onClick={() => onPick(query)}>
            {query}
          </Chip>
        ))}
      </div>
    </section>
  );
}
