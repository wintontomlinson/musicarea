import { NextResponse } from 'next/server';
import { api } from '@/lib/api';
import type { Lyrics, LyricLine } from '@/lib/lyrics';
import { hasWords, parseLrc, parsePlain } from '@/lib/lyrics';
import { SITE } from '@/lib/config';

/**
 * Lyrics for a track, from whichever source can actually provide them.
 *
 * Two sources with different strengths, so the preference order is by *usefulness of the
 * result*, not by source:
 *
 * 1. **Timed lyrics from LRCLIB** (lrclib.net, a free open database of synchronised
 *    lyrics). The only source available to this app with per-line timings, so it wins
 *    whenever it has them, because nothing else can produce karaoke.
 * 2. **Untimed lyrics from the catalogue's own endpoint.** Preferred over LRCLIB's untimed
 *    copy, because for this repertoire it is likelier to have the right language and
 *    transliteration.
 * 3. **Untimed lyrics from LRCLIB**, as a last resort.
 *
 * The caveat that shapes the whole design: LRCLIB's coverage of Bollywood and regional
 * Indian music is far thinner than its coverage of Western pop. For this catalogue the
 * untimed path is the common outcome, not the edge case. Hence `synced` and `static` are
 * distinguished explicitly in the response, and the UI builds a real reading view for
 * `static` rather than treating it as a failure.
 *
 * LRCLIB is matched on metadata rather than an id, since the two services share no
 * identifiers. Duration is the strongest signal in that set: it is what separates a cover
 * or a remix from the original recording.
 */

/** LRCLIB asks clients to identify themselves. */
const USER_AGENT = `${SITE.name} (${SITE.url})`;

/** LRCLIB is an enhancement, so it is never allowed to hold up the response. */
const LRCLIB_TIMEOUT_MS = 3500;

interface LrclibResponse {
  instrumental?: boolean;
  plainLyrics?: string | null;
  syncedLyrics?: string | null;
}

/** What LRCLIB was able to offer, before deciding whether to use it. */
type LrclibOutcome =
  | { kind: 'synced'; lines: LyricLine[] }
  | { kind: 'plain'; lines: LyricLine[] }
  | { kind: 'instrumental' }
  | null;

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'Missing song id' }, { status: 400 });

  const search = new URL(req.url).searchParams;
  const track = search.get('track')?.trim() ?? '';
  const artist = search.get('artist')?.trim() ?? '';
  const album = search.get('album')?.trim() ?? '';
  const duration = Number(search.get('duration') ?? '');

  // Metadata comes from the client because the player already holds the full track record.
  // Re-fetching the song server-side just to read its own title would be a second round
  // trip for data we were handed.
  const lrclib: LrclibOutcome =
    track && artist ? await fromLrclib({ track, artist, album, duration }) : null;

  // Timed lyrics are the only thing that unlocks karaoke, so they win outright.
  if (lrclib?.kind === 'synced') {
    return json({ kind: 'synced', lines: lrclib.lines, source: 'lrclib' });
  }

  const catalogue = await fromCatalogue(id);
  if (catalogue) return json(catalogue);

  if (lrclib?.kind === 'plain') {
    return json({ kind: 'static', lines: lrclib.lines, source: 'lrclib' });
  }

  // Checked after the catalogue on purpose. LRCLIB marks a track instrumental against its
  // own matched recording, and a metadata match can land on the wrong version, so a real
  // set of words from the catalogue is better evidence than LRCLIB's flag.
  if (lrclib?.kind === 'instrumental') return json({ kind: 'instrumental' });

  // 200 with `kind: 'none'` rather than 404. "This track has no lyrics" is a successful
  // answer to the question, and the client caches it so it stops asking.
  return json({ kind: 'none' });
}

function json(lyrics: Lyrics) {
  return NextResponse.json(lyrics, {
    // Lyrics for a released track are effectively immutable, and this route fans out to a
    // third party, so it is worth caching hard at the edge.
    headers: { 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400' },
  });
}

async function fromLrclib({
  track,
  artist,
  album,
  duration,
}: {
  track: string;
  artist: string;
  album: string;
  duration: number;
}): Promise<LrclibOutcome> {
  const query = new URLSearchParams({ track_name: track, artist_name: artist });
  if (album) query.set('album_name', album);
  // Sent only when known. An absent duration widens the match, which is better than
  // sending zero and asking for a recording that is no seconds long.
  if (Number.isFinite(duration) && duration > 0) {
    query.set('duration', String(Math.round(duration)));
  }

  try {
    const res = await fetch(`https://lrclib.net/api/get?${query.toString()}`, {
      headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
      // A timeout signal rather than Next's `revalidate`, because passing a signal opts the
      // request out of the fetch cache anyway. The edge `Cache-Control` set by `json()`
      // does the caching instead, and a third party that hangs must not hang this route.
      signal: AbortSignal.timeout(LRCLIB_TIMEOUT_MS),
    });
    // 404 is the ordinary answer for a track they do not have, which for this catalogue is
    // most of them. Not an error, and not worth reporting.
    if (!res.ok) return null;

    const data = (await res.json()) as LrclibResponse;

    if (data.syncedLyrics) {
      const lines = parseLrc(data.syncedLyrics);
      if (hasWords(lines)) return { kind: 'synced', lines };
    }

    if (data.plainLyrics) {
      const lines = parsePlain(data.plainLyrics);
      if (hasWords(lines)) return { kind: 'plain', lines };
    }

    // Reported last, so an instrumental flag never masks lyrics that were also present.
    if (data.instrumental) return { kind: 'instrumental' };

    return null;
  } catch {
    // Timeout, network failure, or malformed JSON. Lyrics are an enhancement; failing to
    // fetch them must never surface as an error.
    return null;
  }
}

async function fromCatalogue(id: string): Promise<Lyrics | null> {
  try {
    const data = await api.lyrics(id);
    if (!data?.lyrics) return null;
    const lines = parsePlain(data.lyrics);
    if (!hasWords(lines)) return null;
    return {
      kind: 'static',
      lines,
      source: 'catalogue',
      copyright: data.copyright?.trim() || undefined,
    };
  } catch {
    // A 404 means this track has no lyrics, the expected outcome for much of the
    // catalogue. Anything else is an outage. Both resolve to "nothing to show", and the
    // caller reports it as `none`.
    return null;
  }
}
