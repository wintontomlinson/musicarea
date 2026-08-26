import { ApiError } from './api';

/**
 * Outcome of loading a single catalogue entity for a detail page.
 *
 * The distinction matters. Every detail page used to `catch { return null }` and
 * then call `notFound()`, so a catalogue outage made the whole site report that
 * every song, album, artist and playlist did not exist. That is wrong for the
 * listener (nothing is broken about the link they followed) and worse for search
 * engines, which would happily crawl "Song not found" pages for real URLs and
 * drop them from the index.
 */
export type EntityResult<T> =
  | { status: 'found'; data: T }
  /** The catalogue answered, and it has no such entity. */
  | { status: 'missing' }
  /** The catalogue could not be reached, or failed. The entity may well exist. */
  | { status: 'unavailable' };

/**
 * Run a catalogue fetch and classify the outcome.
 *
 * `present` decides whether a successful response actually describes an entity,
 * since the API answers 200 with an empty payload for an unknown id rather than
 * a 404.
 */
export async function loadEntity<Raw, T extends Raw>(
  fetcher: () => Promise<Raw>,
  present: (value: Raw) => value is T,
): Promise<EntityResult<T>> {
  try {
    const data = await fetcher();
    // `present` is a type guard, so a "found" result carries the narrowed type
    // and callers never have to re-check for null.
    return present(data) ? { status: 'found', data } : { status: 'missing' };
  } catch (err) {
    // Only a genuine 404 from upstream means the entity is absent. A 503 (the
    // service is unreachable) or a 5xx is a availability problem on our side.
    if (err instanceof ApiError && err.status === 404) return { status: 'missing' };
    return { status: 'unavailable' };
  }
}
