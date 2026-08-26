import type { HistoryEntry } from './types';

/** Matches the server's own cap in `_history()`. */
const MAX_ENTRIES = 400;
const MAX_ARTISTS_PER_ENTRY = 12;
const MAX_ID = 200;
const MAX_TEXT = 160;

/**
 * Sanitise a listening history arriving from the browser before forwarding it.
 *
 * The route handlers accept a body that a client controls, and Flask enforces a
 * 128 KiB limit and rejects the whole request with a 413 if it is exceeded. The
 * browser store already keeps the log lean and capped, but nothing about a route
 * handler guarantees its caller did, so the same bounds are applied here rather
 * than trusting the payload and turning a bad request into a broken feed.
 *
 * Fields are allow-listed to exactly what `_history()` keeps, so anything else a
 * caller sends is dropped instead of spending the byte budget.
 */
export function sanitiseHistory(value: unknown): HistoryEntry[] {
  if (!Array.isArray(value)) return [];
  const out: HistoryEntry[] = [];
  // Newest entries matter most, and the server keeps the tail, so trim there.
  for (const raw of value.slice(-MAX_ENTRIES)) {
    if (!raw || typeof raw !== 'object') continue;
    const row = raw as Record<string, unknown>;
    const id = typeof row.id === 'string' ? row.id : '';
    if (!id || id.length > MAX_ID) continue;

    const entry: HistoryEntry = { id };
    if (typeof row.name === 'string') entry.name = row.name.slice(0, MAX_TEXT);
    if (typeof row.language === 'string') entry.language = row.language.slice(0, MAX_TEXT);
    if (typeof row.year === 'string' || typeof row.year === 'number') entry.year = row.year;
    if (typeof row.playCount === 'number') entry.playCount = row.playCount;
    if (typeof row.event === 'string') entry.event = row.event as HistoryEntry['event'];
    if (typeof row.at === 'number') entry.at = row.at;

    if (Array.isArray(row.artists)) {
      const artists = row.artists
        .slice(0, MAX_ARTISTS_PER_ENTRY)
        .map((a) => (a && typeof a === 'object' ? (a as Record<string, unknown>) : null))
        .filter((a): a is Record<string, unknown> => !!a && typeof a.id === 'string' && !!a.id)
        .map((a) => ({
          id: String(a.id).slice(0, MAX_ID),
          name: typeof a.name === 'string' ? a.name.slice(0, MAX_TEXT) : '',
        }));
      if (artists.length) entry.artists = artists;
    }

    out.push(entry);
  }
  return out;
}
