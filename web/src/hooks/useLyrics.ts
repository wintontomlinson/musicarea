'use client';

import { useEffect } from 'react';
import type { Song } from '@/lib/types';
import type { Lyrics } from '@/lib/lyrics';
import { artistLine, primaryArtist } from '@/lib/utils';
import { useLyricsCache } from '@/stores/lyrics';

/** What the pane should render right now. */
export type LyricsState = { kind: 'idle' } | { kind: 'loading' } | { kind: 'ready'; lyrics: Lyrics };

/**
 * Fetches and caches lyrics for a track.
 *
 * `enabled` exists so the request only happens while the pane is actually open. Lyrics are a
 * secondary view, and fetching them for every track that starts playing would mean an
 * outbound request per track for content nobody asked to see.
 *
 * There is deliberately no check against `Song.hasLyrics`. That field is unreliable
 * upstream: roughly a fifth of tracks reporting `false` do in fact have lyrics, so
 * filtering on it would silently hide them. The lookup is always attempted and its answer
 * trusted over the flag.
 */
export function useLyrics(song: Song | null, enabled: boolean): LyricsState {
  const songId = song?.id ?? null;

  // Subscribed with selectors so this component re-renders when its own entry lands, without
  // every other consumer of the cache re-rendering on unrelated writes.
  const entry = useLyricsCache((state) => (songId ? state.entries[songId] : undefined));
  const pending = useLyricsCache((state) => (songId ? state.pending[songId] === true : false));

  useEffect(() => {
    if (!enabled || !song || !songId) return;

    // Read through the store rather than the subscribed values above, because `get` applies
    // the TTL and these guards are about whether a *fetch* is needed. Display below
    // deliberately ignores expiry.
    const store = useLyricsCache.getState();
    if (store.get(songId) || store.isPending(songId)) return;

    const controller = new AbortController();
    store.markPending(songId);

    // Metadata is sent along because the third-party lyrics service matches on title, artist
    // and duration rather than on any id this app shares with it. The player already holds
    // the full record, so passing it avoids a server-side re-fetch of the same song.
    const query = new URLSearchParams({ track: song.name ?? '' });
    const artist = primaryArtist(song)?.name ?? artistLine(song);
    if (artist && artist !== 'Unknown artist') query.set('artist', artist);
    if (song.album?.name) query.set('album', song.album.name);
    if (typeof song.duration === 'number' && song.duration > 0) {
      query.set('duration', String(song.duration));
    }

    fetch(`/api/lyrics/${encodeURIComponent(songId)}?${query.toString()}`, {
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error('lyrics unavailable');
        return res.json() as Promise<Lyrics>;
      })
      .then((lyrics) => useLyricsCache.getState().set(songId, lyrics))
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') {
          // Skipping to another track mid-request. Clearing the flag matters: left set, this
          // track would be permanently un-fetchable for the rest of the session.
          useLyricsCache.getState().clearPending(songId);
          return;
        }
        // A failure is recorded as "none" so the pane shows its empty state rather than
        // spinning forever. The short miss TTL means it gets retried before long.
        useLyricsCache.getState().set(songId, { kind: 'none' });
      });

    return () => controller.abort();
  }, [enabled, songId, song]);

  if (!enabled || !songId) return { kind: 'idle' };
  // Expiry is not applied here on purpose. The TTL governs when to re-request, not how long a
  // result may be shown, and checking it at the display layer would make the words vanish
  // mid-song if the pane happened to stay open past the window.
  if (entry) return { kind: 'ready', lyrics: entry.lyrics };
  if (pending) return { kind: 'loading' };
  return { kind: 'loading' };
}
