import type {
  Album,
  ApiEnvelope,
  Artist,
  BrowseData,
  ChartCard,
  FeedData,
  HistoryEntry,
  MixesData,
  MoodSet,
  Playlist,
  RadioStation,
  SearchAllData,
  SearchResult,
  Song,
} from './types';

/**
 * Single source of truth for talking to the MusicArea Flask API.
 *
 * Server-only by design. Every call here runs on the server (from a server
 * component or a route handler under `src/app/api/`), so the base URL points at
 * the internal Flask service and is read from a variable without a
 * `NEXT_PUBLIC_` prefix, keeping it out of the browser bundle. There was a
 * `NEXT_PUBLIC_FLASK_API_BASE` fallback here that no environment ever set and
 * that could only have worked by exposing the internal host to the client, where
 * Flask sends no CORS headers anyway.
 */
const API_BASE = process.env.FLASK_API_BASE || 'http://127.0.0.1:5000';

interface FetchOptions {
  /** ISR revalidation window in seconds. Catalogue data is cacheable. */
  revalidate?: number;
  method?: 'GET' | 'POST';
  body?: unknown;
}

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function call<T>(path: string, opts: FetchOptions = {}): Promise<T> {
  const { revalidate = 300, method = 'GET', body } = opts;
  const url = `${API_BASE}${path}`;

  const init: RequestInit & { next?: { revalidate: number } } = {
    method,
    headers: { Accept: 'application/json' },
    next: { revalidate },
  };

  if (body !== undefined) {
    init.method = 'POST';
    (init.headers as Record<string, string>)['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
    // Personalized POSTs must not be cached.
    init.cache = 'no-store';
    delete init.next;
  }

  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (err) {
    throw new ApiError(
      `Could not reach the music service (${(err as Error).message})`,
      503,
    );
  }

  const json = (await res.json().catch(() => ({}))) as ApiEnvelope<T>;
  if (!res.ok || json.success === false) {
    throw new ApiError(json.message || `Request failed (${res.status})`, res.status);
  }
  return json.data as T;
}

export const api = {
  /** Editorial browse shelves for the selected languages. */
  browse(languages: string[] = ['hindi']): Promise<BrowseData> {
    const q = languages.length ? `?languages=${encodeURIComponent(languages.join(','))}` : '';
    return call<BrowseData>(`/api/browse${q}`, { revalidate: 300 });
  },

  /** The personalized feed. History is client state, so this is never cached. */
  feed(payload: {
    history: HistoryEntry[];
    languages: string[];
    limit?: number;
    mood?: string;
  }): Promise<FeedData> {
    return call<FeedData>('/api/feed', { body: payload });
  },

  async searchAll(query: string): Promise<SearchAllData> {
    const data = await call<SearchAllData>(`/api/search?query=${encodeURIComponent(query)}`, {
      revalidate: 120,
    });
    return normalizeSearchAll(data);
  },

  async searchSongs(query: string, limit = 30): Promise<Song[]> {
    // This endpoint wraps its list in { results, start, total }.
    const data = await call<{ results: Song[] } | Song[]>(
      `/api/search/songs?query=${encodeURIComponent(query)}&limit=${limit}`,
      { revalidate: 120 },
    );
    return Array.isArray(data) ? data : data.results ?? [];
  },

  song(id: string): Promise<Song[]> {
    return call<Song[]>(`/api/songs/${encodeURIComponent(id)}`, { revalidate: 600 });
  },

  album(id: string): Promise<Album> {
    return call<Album>(`/api/albums?id=${encodeURIComponent(id)}`, { revalidate: 600 });
  },

  artist(id: string): Promise<Artist> {
    return call<Artist>(
      `/api/artists/${encodeURIComponent(id)}?songCount=10&albumCount=20`,
      { revalidate: 600 },
    );
  },

  artistSongs(id: string, page = 0): Promise<{ total?: number; songs: Song[] }> {
    return call<{ total?: number; songs: Song[] }>(
      `/api/artists/${encodeURIComponent(id)}/songs?page=${page}`,
      { revalidate: 600 },
    );
  },

  playlist(id: string, limit = 100): Promise<Playlist> {
    return call<Playlist>(
      `/api/playlists?id=${encodeURIComponent(id)}&limit=${limit}`,
      { revalidate: 600 },
    );
  },

  mood(id: string, limit = 40): Promise<MoodSet> {
    return call<MoodSet>(`/api/moods/${encodeURIComponent(id)}?limit=${limit}`, { revalidate: 300 });
  },

  /** Editorial chart playlists (each opens to a ranked song list). */
  charts(): Promise<{ items: ChartCard[] }> {
    return call<{ items: ChartCard[] }>('/api/charts', { revalidate: 600 });
  },

  /**
   * An endless station seeded from one track.
   *
   * Cached briefly despite being algorithmic. The station is a pure function of the
   * seed id, so two listeners starting from the same track get the same station, and
   * a short window absorbs the double-tap without making the result feel stale.
   */
  radio(songId: string, limit = 40): Promise<RadioStation> {
    return call<RadioStation>(
      `/api/radio/${encodeURIComponent(songId)}?limit=${limit}`,
      { revalidate: 300 },
    );
  },

  artistRadio(artistId: string, limit = 40): Promise<RadioStation> {
    return call<RadioStation>(
      `/api/artists/${encodeURIComponent(artistId)}/radio?limit=${limit}`,
      { revalidate: 300 },
    );
  },

  /**
   * Personalised mixes built from the listener's history.
   *
   * Never cached, like `feed`, because the input is client state. Be aware this is
   * the slowest endpoint in the API: each mix runs its own recall pass, and a cold
   * response can take several seconds. Callers should fetch it lazily rather than
   * making a page wait on it.
   */
  mixes(payload: { history: HistoryEntry[]; perMix?: number }): Promise<MixesData> {
    return call<MixesData>('/api/mixes', { body: payload });
  },

  /** "More like this" for an arbitrary selection of up to ten songs. */
  similar(payload: { ids: string[]; limit?: number }): Promise<{ items: Song[] }> {
    return call<{ items: Song[] }>('/api/similar', { body: payload });
  },

  /** Catalogue-native autoplay suggestions for a track. */
  suggestions(songId: string, limit = 10): Promise<Song[]> {
    return call<Song[]>(
      `/api/songs/${encodeURIComponent(songId)}/suggestions?limit=${limit}`,
      { revalidate: 300 },
    );
  },
};

/**
 * Search is the one endpoint whose rows are assembled from loosely typed
 * upstream payloads, so `title` and `type` can come back null. `SearchResult`
 * declares both as required, and every consumer trusts that: a null title threw
 * from `decodeEntities` and a null type threw from `resultSubtitle`, taking the
 * whole results page down.
 *
 * Rather than make the type nullable and push a guard into each of the six
 * render sites, the data is cleaned once here, at the boundary where it enters
 * the app. Rows without a usable id or type are dropped, since neither a link
 * nor a card can be built from them.
 */
function normalizeSearchAll(data: SearchAllData | null | undefined): SearchAllData {
  if (!data) return {};
  const sections: Array<keyof SearchAllData> = [
    'topQuery',
    'songs',
    'albums',
    'artists',
    'playlists',
  ];
  const out: SearchAllData = {};
  for (const key of sections) {
    const results = data[key]?.results;
    if (!Array.isArray(results)) continue;
    out[key] = { results: results.filter(isUsableResult).map(cleanResult) };
  }
  return out;
}

const RESULT_TYPES = new Set(['song', 'album', 'artist', 'playlist']);

function isUsableResult(row: SearchResult | null | undefined): row is SearchResult {
  return !!row && typeof row.id === 'string' && !!row.id && RESULT_TYPES.has(row.type);
}

function cleanResult(row: SearchResult): SearchResult {
  return { ...row, title: typeof row.title === 'string' ? row.title : '' };
}

export { ApiError };
