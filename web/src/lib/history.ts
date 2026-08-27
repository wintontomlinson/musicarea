import type { HistoryEntry, Song } from '@/lib/types';

/**
 * Turn the local library into the event log the recommender expects.
 *
 * The app has no server-side listening history, so this is the only taste signal
 * available. Getting the shape right matters more than it looks:
 *
 * **Ordering is load-bearing.** The API keeps the *last* 400 entries of whatever it
 * is sent. The library stores newest-first, so passing it straight through would mean
 * that once the log exceeded the cap the recent plays were the entries thrown away.
 * Everything here is emitted oldest-first for that reason.
 *
 * **Likes are separate events, not just songs.** A like is weighted 2.6 against a
 * play's 1.0, so sending favourites as a distinct `like` event is what lets a
 * deliberately saved track outrank something left on in the background.
 *
 * **Timestamps are sent where they are known and omitted where they are not.** The
 * recommender halves an event's weight every three weeks and treats an undated entry
 * as 0.35. Inventing `Date.now()` for an undated record would make ancient history
 * look like it happened this minute, which is worse than being honestly vague.
 */

/** Matches the API's own cap, so nothing is silently discarded server-side. */
const MAX_ENTRIES = 400;

function toEntry(song: Song, event: 'play' | 'like', at?: number): HistoryEntry {
  const entry: HistoryEntry = { id: song.id, event };
  if (song.name) entry.name = song.name;
  if (song.language) entry.language = song.language;
  if (song.year !== null && song.year !== undefined) entry.year = song.year;
  if (typeof song.playCount === 'number') entry.playCount = song.playCount;
  if (typeof at === 'number') entry.at = at;
  // Only credits with an id survive the API's validation, so filtering here keeps the
  // payload honest about how much artist signal is actually being sent.
  const artists = (song.artists?.primary ?? song.artists?.all ?? [])
    .filter((artist) => artist.id && artist.name)
    .slice(0, 12)
    .map((artist) => ({ id: artist.id, name: artist.name }));
  if (artists.length) entry.artists = artists;
  return entry;
}

export function buildHistory({
  recent,
  liked,
  playedAt = {},
  likedAt = {},
}: {
  recent: Song[];
  liked: Song[];
  playedAt?: Record<string, number>;
  likedAt?: Record<string, number>;
}): HistoryEntry[] {
  const plays = recent.map((song) => toEntry(song, 'play', playedAt[song.id]));
  const likes = liked.map((song) => toEntry(song, 'like', likedAt[song.id]));

  // Both source lists are newest-first. Reversing puts the oldest first, so the cap
  // below trims history from the far past rather than from this afternoon.
  const combined = [...likes.reverse(), ...plays.reverse()];
  return combined.slice(-MAX_ENTRIES);
}

/** True when there is too little history for personalisation to mean anything. */
export function isColdStart(entries: HistoryEntry[]): boolean {
  // The threshold is a judgement call, not a value from the API. Below roughly this
  // many events the feed is dominated by whatever one or two tracks were played, and
  // presenting that as "based on your listening" oversells it.
  return entries.length < 5;
}
