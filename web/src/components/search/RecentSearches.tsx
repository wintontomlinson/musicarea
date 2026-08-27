'use client';

import { useEffect } from 'react';
import { useSearchHistory } from '@/stores/search';
import { Icon } from '@/components/ui/Icon';

/**
 * Previous searches on this device.
 *
 * A list rather than chips, and each row has its own delete control. Search history is
 * personal in a way trending suggestions are not: a listener may well want to remove one
 * entry without wiping the lot, and offering only "clear all" makes that impossible.
 */
export function RecentSearches({ onPick }: { onPick: (query: string) => void }) {
  const hydrate = useSearchHistory((state) => state.hydrate);
  const hydrated = useSearchHistory((state) => state.hydrated);
  const recent = useSearchHistory((state) => state.recent);
  const remove = useSearchHistory((state) => state.remove);
  const clear = useSearchHistory((state) => state.clear);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // Nothing before hydration: the server cannot read localStorage, so rendering the list here
  // would guarantee a hydration mismatch.
  if (!hydrated || recent.length === 0) return null;

  return (
    <section aria-labelledby="recent-searches">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2
          id="recent-searches"
          className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-[0.12em] text-text-muted"
        >
          <Icon name="clock" size={15} className="text-accent-soft" />
          Recent searches
        </h2>
        <button
          type="button"
          onClick={clear}
          className="text-[12px] font-bold text-accent-soft transition hover:text-white"
        >
          Clear all
        </button>
      </div>

      <ul className="flex flex-col">
        {recent.map((query) => (
          <li key={query} className="group flex items-center gap-2">
            <button
              type="button"
              onClick={() => onPick(query)}
              className="flex min-w-0 flex-1 items-center gap-3 rounded-card px-2 py-2.5 text-left transition hover:bg-white/[0.06]"
            >
              <Icon name="search" size={15} className="shrink-0 text-text-muted" />
              <span className="min-w-0 flex-1 truncate text-[14px]">{query}</span>
            </button>
            <button
              type="button"
              aria-label={`Remove ${query} from recent searches`}
              onClick={() => remove(query)}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-text-muted transition hover:bg-white/10 hover:text-white lg:opacity-0 lg:group-hover:opacity-100 lg:focus-visible:opacity-100"
            >
              <Icon name="close" size={14} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
