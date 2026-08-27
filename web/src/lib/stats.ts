import type { Song } from '@/lib/types';
import { primaryArtist } from '@/lib/utils';

/**
 * Listening statistics derived from local history.
 *
 * Everything here is computed from `stores/library.ts`, which means it describes
 * this browser and nothing else: there is no account, no server-side history, and
 * no cross-device sync. The functions are deliberately honest about that, and the
 * UI that renders them says so.
 *
 * The history list is also capped (`MAX_RECENT`, currently 60 entries) and holds no
 * per-play timestamps, so genuine totals such as minutes listened and day streaks
 * are not computable from it. Those need the append-only play log, which is a
 * separate change; nothing here fabricates them in the meantime.
 */

export interface Tally {
  key: string;
  label: string;
  count: number;
  /** Carried so the UI can show artwork or link to the artist. */
  sample: Song;
  id?: string;
}

function rank(map: Map<string, Tally>, limit: number): Tally[] {
  return [...map.values()]
    // Ties are broken alphabetically rather than left to insertion order, so the
    // list does not reshuffle between renders when several artists are level.
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, limit);
}

/** Most frequent primary artists across the given songs. */
export function topArtists(songs: Song[], limit = 5): Tally[] {
  const map = new Map<string, Tally>();
  for (const song of songs) {
    const artist = primaryArtist(song);
    // Keyed on the artist id where there is one, because the same artist is spelled
    // inconsistently across the catalogue ("A.R. Rahman" and "AR Rahman"), which
    // would otherwise split one artist into two entries.
    const key = artist?.id || artist?.name;
    if (!key || !artist?.name) continue;
    const existing = map.get(key);
    if (existing) existing.count += 1;
    else map.set(key, { key, label: artist.name, count: 1, sample: song, id: artist.id });
  }
  return rank(map, limit);
}

/** Languages present in the given songs, most frequent first. */
export function topLanguages(songs: Song[], limit = 5): Tally[] {
  const map = new Map<string, Tally>();
  for (const song of songs) {
    const language = song.language?.trim().toLowerCase();
    if (!language) continue;
    const existing = map.get(language);
    if (existing) existing.count += 1;
    else {
      map.set(language, {
        key: language,
        label: language.charAt(0).toUpperCase() + language.slice(1),
        count: 1,
        sample: song,
      });
    }
  }
  return rank(map, limit);
}

/** Distinct primary artists, for an "artists in rotation" figure. */
export function uniqueArtistCount(songs: Song[]): number {
  const seen = new Set<string>();
  for (const song of songs) {
    const artist = primaryArtist(song);
    const key = artist?.id || artist?.name;
    if (key) seen.add(key);
  }
  return seen.size;
}


/**
 * Consecutive days, ending today or yesterday, on which something was played.
 *
 * This became computable only once the library store began recording *when* each song was played.
 * Before that there were no timestamps at all, which is why this deliberately did not exist: a
 * streak invented from an undated list would have been decoration.
 *
 * Days are bucketed in **local** time, not UTC. A listener in Mumbai playing something at 1am
 * expects that to count as that day, and UTC bucketing would file it under the previous one.
 *
 * A streak that ended yesterday still counts, and `activeToday` says which case it is. Resetting the
 * moment midnight passes would tell someone their twelve-day run was over before they had a chance
 * to play anything.
 */
export function listeningStreak(playedAt: Record<string, number>): {
  days: number;
  activeToday: boolean;
} {
  const stamps = Object.values(playedAt).filter((at) => typeof at === 'number' && Number.isFinite(at));
  if (stamps.length === 0) return { days: 0, activeToday: false };

  const days = new Set(stamps.map(dayKey));
  const today = dayKey(Date.now());
  const yesterday = dayKey(Date.now() - DAY_MS);

  // Anchored to whichever of today or yesterday has a play. Anything older means the run is broken
  // and there is no current streak to report.
  let cursor: number;
  if (days.has(today)) cursor = Date.now();
  else if (days.has(yesterday)) cursor = Date.now() - DAY_MS;
  else return { days: 0, activeToday: false };

  let count = 0;
  // Walks backwards a day at a time. Bounded by the set size, so a sparse history cannot loop
  // indefinitely.
  while (days.has(dayKey(cursor)) && count <= days.size) {
    count += 1;
    cursor -= DAY_MS;
  }

  return { days: count, activeToday: days.has(today) };
}

const DAY_MS = 86_400_000;

/**
 * A local-time day bucket.
 *
 * Built from the date parts rather than by dividing the timestamp, because dividing assumes days are
 * a fixed length in the listener's timezone, which daylight-saving transitions break.
 */
function dayKey(at: number): number {
  const date = new Date(at);
  return date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
}

/**
 * Total duration of the given songs, in seconds.
 *
 * Named for what it measures. It is the combined length of the tracks in a list, which is *not* the
 * same as time spent listening: a skipped track contributes its whole duration. The UI labels it
 * accordingly rather than calling it minutes listened.
 */
export function totalDuration(songs: Song[]): number {
  return songs.reduce((sum, song) => sum + (song.duration ?? 0), 0);
}
