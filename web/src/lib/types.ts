/**
 * Types mirroring the MusicArea Flask API responses. Shapes were confirmed
 * against live responses from /api/browse, /api/feed and /api/search rather
 * than guessed. Image and download URLs arrive as quality-tagged arrays.
 */

export interface QualityUrl {
  quality: string;
  url: string;
}

export interface ArtistRef {
  id: string;
  name: string;
  image?: QualityUrl[];
  role?: string;
  type?: string;
  url?: string;
}

export interface SongArtists {
  primary?: ArtistRef[];
  featured?: ArtistRef[];
  all?: ArtistRef[];
}

export interface AlbumRef {
  id: string | null;
  name: string | null;
  url?: string | null;
}

/** The eight scoring signals the recommender blends, echoed per track. */
export type SignalName =
  | 'artist'
  | 'collab'
  | 'session'
  | 'language'
  | 'era'
  | 'popularity'
  | 'freshness'
  | 'recall';

/**
 * Why a track was recommended, attached by the recommender.
 *
 * Everything past `rank` is optional on purpose. A cold-start mood set emits a
 * degraded block carrying only `rank`, `reason` and `personalised`, and the
 * feed's `heavy-rotation` row carries no block at all, so a consumer that
 * assumes `signals` exists will throw on both.
 */
export interface Recommendation {
  rank: number;
  /** Empty string when the winning signal is not personal enough to explain. */
  reason: string | null;
  score?: number;
  signals?: Partial<Record<SignalName, number>>;
  sources?: string[];
  /** False for a mood set built without listening history. */
  personalised?: boolean;
  /** True when the listener has no direct history with the artist. */
  discovery?: boolean;
  /** True when the listener has already heard the track. */
  familiar?: boolean;
}

export interface Song {
  id: string;
  name: string;
  subtitle?: string;
  type: 'song';
  year?: string | number | null;
  releaseDate?: string | null;
  duration?: number | null;
  language?: string;
  playCount?: number | null;
  explicitContent?: boolean;
  hasLyrics?: boolean;
  lyricsId?: string | null;
  label?: string | null;
  copyright?: string | null;
  image?: QualityUrl[];
  downloadUrl?: QualityUrl[];
  artists?: SongArtists;
  album?: AlbumRef;
  recommendation?: Recommendation;
}

/** Album and playlist cards as they appear inside browse/feed rows. */
export interface CollectionCard {
  id: string;
  name: string;
  subtitle?: string;
  type: 'album' | 'playlist';
  year?: string | number | null;
  language?: string;
  songCount?: number | null;
  image?: QualityUrl[];
}

export type RowKind = 'songs' | 'albums' | 'playlists';

export interface Row {
  id: string;
  title: string;
  subtitle?: string;
  kind: RowKind;
  items: Array<Song | CollectionCard>;
  meta?: Record<string, unknown>;
  showAll?: string;
}

export interface Mood {
  id: string;
  name: string;
  hue: number;
  image?: string | null;
  covers?: string[];
  query?: string;
  keyword?: string;
}

export interface MoodSet {
  mood: Mood | null;
  items: Song[];
  meta?: { personalised?: boolean; pool?: number; returned?: number };
}

export interface BrowseData {
  rows: Row[];
  moods: Mood[];
  languages: string[];
  selectedLanguages: string[];
  language: string;
}

export interface FeedProfile {
  /** True until the decayed positive event weight reaches 1.0. */
  coldStart: boolean;
  /** 0..1, the decayed positive weight over 25. Drives the taste meter. */
  strength: number;
  events: number;
  artistCount: number;
  languageCount: number;
  /** Up to 8, descending. The field is `weight`, not `score`. */
  topArtists: Array<{ id?: string; name: string; weight?: number }>;
  /** Up to 3, from the 2-day session half-life rather than the 21-day one. */
  recentArtists: Array<{ id?: string; name: string }>;
  topLanguages: string[];
  preferredLanguages: string[];
  eraCenter: number | null;
  mainstream: number | null;
}

export interface FeedData {
  rows: Row[];
  profile: FeedProfile;
  candidates: number;
}

/**
 * A generated mix from `POST /api/mixes`, the Daily Mix equivalent.
 *
 * Note the field names: the API returns `name`, `items` and `note`, not the
 * `title`/`songs`/`reason` a row uses.
 */
export interface Mix {
  /** `artist-<id>` | `language-<lang>` | `discovery` */
  id: string;
  name: string;
  subtitle?: string;
  /** One line on how the mix was built. */
  note?: string;
  type: 'mix';
  songCount?: number;
  image?: QualityUrl[] | null;
  /** Up to four covers for the collage tile. */
  covers?: Array<QualityUrl[] | null>;
  items: Song[];
}

export interface MixesData {
  mixes: Mix[];
  meta?: {
    coldStart?: boolean;
    reason?: string;
    candidates?: number;
    count?: number;
    profileStrength?: number;
  };
}

/**
 * A station. `GET /api/radio/<songId>` includes the `seed` it was built from;
 * `GET /api/artists/<id>/radio` returns only `items` and `meta`.
 */
export interface RadioSet {
  seed?: Song | null;
  items: Song[];
  meta?: { candidates?: number; returned?: number; seedName?: string; artist?: string };
}

export interface Lyrics {
  lyrics: string;
  copyright?: string | null;
  snippet?: string | null;
}

/**
 * Search-all (autocomplete) results use a lighter, differently-keyed shape than
 * the catalogue: `title` instead of `name`, no stream URLs, and a flat
 * `primaryArtists` string. These are for suggestions and result cards; playing
 * one requires resolving full song details first.
 */
export interface SearchResult {
  id: string;
  title: string;
  type: 'song' | 'album' | 'artist' | 'playlist';
  image?: QualityUrl[];
  description?: string;
  primaryArtists?: string;
  singers?: string;
  album?: { id?: string; name?: string } | string;
  position?: number;
}

export interface SearchAllData {
  topQuery?: { results: SearchResult[] };
  songs?: { results: SearchResult[] };
  albums?: { results: SearchResult[] };
  artists?: { results: SearchResult[] };
  playlists?: { results: SearchResult[] };
}

export interface Album extends CollectionCard {
  description?: string;
  playCount?: number | null;
  artists?: SongArtists;
  songs: Song[];
}

export interface Playlist {
  id: string;
  name: string;
  type: 'playlist';
  image?: QualityUrl[];
  description?: string;
  songCount?: number | null;
  followerCount?: number | null;
  playCount?: number | null;
  language?: string;
  year?: string | number | null;
  songs: Song[];
}

export interface Artist {
  id: string;
  name: string;
  type: 'artist';
  image?: QualityUrl[];
  bio?: Array<{ title?: string; text?: string; sequence?: number }> | string | null;
  followerCount?: number | null;
  fanCount?: number | null;
  isVerified?: boolean;
  dominantLanguage?: string;
  dominantType?: string;
  subtitle?: string;
  topSongs?: Song[];
  topAlbums?: CollectionCard[];
  singles?: CollectionCard[];
  similarArtists?: ArtistRef[] | null;
}

/** A chart is an editorial playlist card; opening it yields the ranked songs. */
export interface ChartCard {
  id: string;
  name?: string;
  title?: string;
  type: 'playlist';
  image?: QualityUrl[];
  subtitle?: string;
  songCount?: number | null;
  language?: string;
}

/** Envelope every Flask endpoint wraps its payload in. */
export interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  message?: string;
}

export interface HistoryEntry {
  id: string;
  name?: string;
  language?: string;
  year?: string | number;
  event?: ListeningEvent;
  /** Milliseconds since the epoch. The decay maths divides by 86_400_000. */
  at?: number;
  playCount?: number;
  /** At most 12 per entry; entries without a string id are dropped server side. */
  artists?: Array<{ id: string; name: string }>;
}

/**
 * The events the recommender scores, with the weight each carries. Mirrored from
 * `EVENT_WEIGHTS` in recommender.py so the client can show a taste strength
 * before the first feed response comes back; it must stay in step with it.
 *
 * An unknown or missing event is treated as a `play` (weight 1.0) server side.
 */
export const EVENT_WEIGHTS = {
  play: 1.0,
  complete: 1.7,
  repeat: 2.2,
  like: 2.6,
  playlist_add: 2.0,
  queue: 1.1,
  search_play: 1.3,
  skip: -0.7,
  dislike: -2.4,
} as const satisfies Record<string, number>;

export type ListeningEvent = keyof typeof EVENT_WEIGHTS;
