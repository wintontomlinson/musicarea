import type {
  Album,
  ApiEnvelope,
  Artist,
  BrowseData,
  ChartCard,
  FeedData,
  HistoryEntry,
  Playlist,
  SearchAllData,
  Song,
} from './types';

/**
 * Single source of truth for talking to the MusicArea Flask API. Server
 * components call these directly (server-to-server), so the base URL points at
 * the internal Flask service. A public fallback lets client code proxy through
 * the same value when needed.
 */
const API_BASE =
  process.env.FLASK_API_BASE ||
  process.env.NEXT_PUBLIC_FLASK_API_BASE ||
  'http://127.0.0.1:5000';

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

  searchAll(query: string): Promise<SearchAllData> {
    return call<SearchAllData>(`/api/search?query=${encodeURIComponent(query)}`, {
      revalidate: 120,
    });
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

  /** Editorial chart playlists (each opens to a ranked song list). */
  charts(): Promise<{ items: ChartCard[] }> {
    return call<{ items: ChartCard[] }>('/api/charts', { revalidate: 600 });
  },
};

export { ApiError, API_BASE };
