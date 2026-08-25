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

export interface Recommendation {
  rank: number;
  score: number;
  reason: string | null;
  signals: Record<string, number>;
  sources: string[];
  discovery: boolean;
  familiar: boolean;
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

export interface BrowseData {
  rows: Row[];
  moods: Mood[];
  languages: string[];
  selectedLanguages: string[];
  language: string;
}

export interface FeedProfile {
  coldStart: boolean;
  strength: number;
  events: number;
  artistCount: number;
  languageCount: number;
  topArtists: Array<{ id?: string; name: string; score?: number }>;
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
  event?: string;
  at?: number;
  playCount?: number;
  artists?: Array<{ id: string; name: string }>;
}
