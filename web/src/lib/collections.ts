import type { Song } from '@/lib/types';
import { primaryArtist } from '@/lib/utils';

/**
 * Album and artist collections, derived from the songs the listener has saved or played.
 *
 * There is no "saved albums" or "followed artists" concept anywhere in this app: the library
 * holds liked songs and recent plays, and nothing else. So rather than shipping an Albums tab
 * that is permanently empty, or one backed by a follow feature that does not exist, these tabs
 * are derived from what the library genuinely knows: the albums and artists that the saved songs
 * came from.
 *
 * That is a real and useful collection ("albums I have liked tracks from"), and it is described
 * that way in the UI rather than being presented as a list of things the listener explicitly
 * saved.
 */

export interface Collected {
  id: string;
  name: string;
  /** How many songs in the source list belong to this album or artist. */
  count: number;
  /** A song from the group, for its artwork. */
  sample: Song;
}

function rank(map: Map<string, Collected>): Collected[] {
  return [...map.values()].sort(
    // Most-represented first, then alphabetical. The alphabetical tiebreak matters: without it
    // the order of equally-weighted entries depends on insertion order and reshuffles whenever a
    // song is liked, which makes the grid appear to jump for no reason.
    (a, b) => b.count - a.count || a.name.localeCompare(b.name),
  );
}

/** Albums represented in the given songs. */
export function albumsFrom(songs: Song[]): Collected[] {
  const map = new Map<string, Collected>();
  for (const song of songs) {
    const id = song.album?.id;
    const name = song.album?.name;
    // Both are required. Without an id there is no album page to link to, and a card that cannot
    // be opened is worse than one that is not shown.
    if (!id || !name) continue;
    const existing = map.get(id);
    if (existing) existing.count += 1;
    else map.set(id, { id, name, count: 1, sample: song });
  }
  return rank(map);
}

/** Primary artists represented in the given songs. */
export function artistsFrom(songs: Song[]): Collected[] {
  const map = new Map<string, Collected>();
  for (const song of songs) {
    const artist = primaryArtist(song);
    // Keyed on the id, not the name: the catalogue spells the same artist inconsistently
    // ("A.R. Rahman" and "AR Rahman"), which would otherwise split one artist into two cards.
    if (!artist?.id || !artist.name) continue;
    const existing = map.get(artist.id);
    if (existing) existing.count += 1;
    else map.set(artist.id, { id: artist.id, name: artist.name, count: 1, sample: song });
  }
  return rank(map);
}

/**
 * Merge two song lists, keeping the first occurrence of each track.
 *
 * Liked songs come first at every call site, so a track that is both liked and recently played is
 * represented by its liked record.
 */
export function mergeSongs(...lists: Song[][]): Song[] {
  const seen = new Set<string>();
  const out: Song[] = [];
  for (const list of lists) {
    for (const song of list) {
      if (!song?.id || seen.has(song.id)) continue;
      seen.add(song.id);
      out.push(song);
    }
  }
  return out;
}
