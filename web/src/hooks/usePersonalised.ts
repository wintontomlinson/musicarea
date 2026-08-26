'use client';

import { useEffect, useState } from 'react';
import { useHistory } from '@/stores/history';
import { loadFeed, loadMixes, PersonalisedError } from '@/lib/personalised';
import type { FeedData, MixesData } from '@/lib/types';

type Outcome<T> = { revision: number; data: T | null; rateLimited: boolean };

export interface Personalised<T> {
  data: T | null;
  loading: boolean;
  /** True when the recommender is being asked for more than it will serve. */
  rateLimited: boolean;
  /** True once the browser has read the listening log. */
  ready: boolean;
}

/**
 * Subscribe to a personalised endpoint, keyed on the listening log's revision.
 *
 * The result is stored tagged with the revision it was built from, and `loading`
 * is derived by comparing that against the current revision. Keeping a separate
 * boolean would mean setting state synchronously inside the effect, which cascades
 * renders, and would let a response for an older log paint over a newer one.
 */
function usePersonalisedResource<T>(
  fetcher: (history: ReturnType<typeof useHistory.getState>['entries'], revision: number) => Promise<T>,
  enabled = true,
): Personalised<T> {
  const hydrate = useHistory((s) => s.hydrate);
  const hydrated = useHistory((s) => s.hydrated);
  const revision = useHistory((s) => s.revision);
  const [outcome, setOutcome] = useState<Outcome<T> | null>(null);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!hydrated || !enabled) return;
    let alive = true;
    (async () => {
      try {
        const data = await fetcher(useHistory.getState().entries, revision);
        if (alive) setOutcome({ revision, data, rateLimited: false });
      } catch (err) {
        if (!alive) return;
        const rateLimited = err instanceof PersonalisedError && err.status === 429;
        setOutcome({ revision, data: null, rateLimited });
      }
    })();
    return () => {
      alive = false;
    };
    // `fetcher` is a stable module function; re-running on identity would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, enabled, revision]);

  const settled = outcome?.revision === revision ? outcome : null;

  return {
    data: settled?.data ?? null,
    loading: enabled && hydrated && !settled,
    rateLimited: settled?.rateLimited ?? false,
    ready: hydrated,
  };
}

export function usePersonalFeed(limit = 24): Personalised<FeedData> {
  return usePersonalisedResource<FeedData>((history, revision) =>
    loadFeed(history, revision, limit),
  );
}

/**
 * Mixes are only requested once there is something to build them from. Asking
 * with a cold profile spends one of a small rate-limit budget on a response that
 * is always an empty list.
 */
export function useMixes(enabled: boolean): Personalised<MixesData> {
  return usePersonalisedResource<MixesData>(
    (history, revision) => loadMixes(history, revision),
    enabled,
  );
}
