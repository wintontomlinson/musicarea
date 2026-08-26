'use client';

import type { FeedData, HistoryEntry, MixesData } from './types';

/**
 * Client-side cache for the two personalised endpoints.
 *
 * Caching here is not an optimisation, it is a requirement. Flask rate-limits
 * the recommender routes to 35 requests a minute and keys the bucket on the
 * socket address; since these calls arrive through this app's own route
 * handlers, every visitor shares one bucket. On top of that a cold mixes build
 * runs several recall passes and takes seconds.
 *
 * Neither response can be cached at the HTTP layer, because both are POSTs whose
 * result depends on a listening log that lives in the browser. So the cache is
 * here, keyed on the log's revision: a new event invalidates it, and nothing else
 * does until the window expires.
 */

/** Matches the legacy client's four-minute feed window. */
const FEED_TTL_MS = 4 * 60 * 1000;
/** Mixes are far more expensive to build, so they are held ten times longer. */
const MIXES_TTL_MS = 10 * 60 * 1000;

/** Back-off after a 429, so a rate-limited client stops making it worse. */
const RATE_LIMIT_BACKOFF_MS = 60 * 1000;

interface CacheEntry<T> {
  revision: number;
  at: number;
  data: T;
}

interface Cache<T> {
  entry: CacheEntry<T> | null;
  /** In-flight request, so concurrent callers share one round trip. */
  inflight: Promise<T> | null;
  inflightRevision: number;
  blockedUntil: number;
}

const feedCache: Cache<FeedData> = {
  entry: null,
  inflight: null,
  inflightRevision: -1,
  blockedUntil: 0,
};
const mixesCache: Cache<MixesData> = {
  entry: null,
  inflight: null,
  inflightRevision: -1,
  blockedUntil: 0,
};

export class PersonalisedError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'PersonalisedError';
    this.status = status;
  }
}

async function post<T>(path: string, body: unknown, cache: Cache<T>): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (res.status === 429) {
    cache.blockedUntil = Date.now() + RATE_LIMIT_BACKOFF_MS;
    throw new PersonalisedError('Rate limited', 429);
  }
  if (!res.ok) throw new PersonalisedError(`Request failed (${res.status})`, res.status);
  return (await res.json()) as T;
}

function fresh<T>(cache: Cache<T>, revision: number, ttl: number): T | null {
  const { entry } = cache;
  if (!entry) return null;
  if (entry.revision !== revision) return null;
  if (Date.now() - entry.at > ttl) return null;
  return entry.data;
}

async function load<T>(
  cache: Cache<T>,
  revision: number,
  ttl: number,
  run: () => Promise<T>,
): Promise<T> {
  const cached = fresh(cache, revision, ttl);
  if (cached) return cached;

  // Share an in-flight request only when it is for the same log revision;
  // otherwise its result is already stale before it lands.
  if (cache.inflight && cache.inflightRevision === revision) return cache.inflight;

  if (Date.now() < cache.blockedUntil) {
    // Serve something rather than nothing while backing off.
    if (cache.entry) return cache.entry.data;
    throw new PersonalisedError('Rate limited', 429);
  }

  const promise = run()
    .then((data) => {
      cache.entry = { revision, at: Date.now(), data };
      return data;
    })
    .finally(() => {
      if (cache.inflightRevision === revision) {
        cache.inflight = null;
        cache.inflightRevision = -1;
      }
    });

  cache.inflight = promise;
  cache.inflightRevision = revision;
  return promise;
}

export function loadFeed(
  history: HistoryEntry[],
  revision: number,
  limit = 24,
): Promise<FeedData> {
  return load(feedCache, revision, FEED_TTL_MS, () =>
    post<FeedData>('/api/feed', { history, limit }, feedCache),
  );
}

export function loadMixes(history: HistoryEntry[], revision: number): Promise<MixesData> {
  return load(mixesCache, revision, MIXES_TTL_MS, () =>
    post<MixesData>('/api/mixes', { history }, mixesCache),
  );
}

/** Drop both caches. Used when the listening history is cleared outright. */
export function resetPersonalised() {
  feedCache.entry = null;
  mixesCache.entry = null;
}
