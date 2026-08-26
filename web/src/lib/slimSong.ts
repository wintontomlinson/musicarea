import type { Song } from './types';

/**
 * Reduce a song to what is worth keeping in localStorage.
 *
 * `downloadUrl` is dropped: the arrays hold five URLs per track, and the CDN
 * links are signed and expire, so storing them would spend quota on values that
 * go stale. The audio engine already resolves a stream on demand through
 * `/api/song/[id]` when a queued track arrives without one, which is exactly the
 * case a stored song hits.
 *
 * `recommendation` is dropped too: it explains why a track surfaced in one
 * particular feed, which means nothing once the track has been saved by hand.
 */
export function slimSong(song: Song): Song {
  const { downloadUrl: _downloadUrl, recommendation: _recommendation, ...rest } = song;
  return rest;
}

/**
 * Drop anything that is not a usable song record, so one bad write cannot break
 * every screen that reads from storage.
 */
export function sanitiseSongs(list: unknown): Song[] {
  if (!Array.isArray(list)) return [];
  return list.filter(
    (item): item is Song =>
      !!item &&
      typeof item === 'object' &&
      typeof (item as Song).id === 'string' &&
      !!(item as Song).id,
  );
}
