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

export interface SearchAllData {
  topQuery?: string[];
  songs?: { results: Song[] };
  albums?: { results: CollectionCard[] };
  artists?: { results: ArtistRef[] };
  playlists?: { results: CollectionCard[] };
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
