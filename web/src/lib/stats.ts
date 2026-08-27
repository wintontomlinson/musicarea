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
