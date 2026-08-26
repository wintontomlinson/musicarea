import type { ArtistRef, CollectionCard, QualityUrl, Song } from './types';

/**
 * Pick the best image URL at or near a target size. The API returns an array of
 * quality-tagged variants (50x50, 150x150, 500x500). We prefer the 500x500
 * variant for crisp artwork, falling back to the largest available.
 */
export function pickImage(
  images: QualityUrl[] | undefined,
  target: '500x500' | '150x150' | '50x50' = '500x500',
): string {
  if (!images || images.length === 0) return FALLBACK_COVER;
  const exact = images.find((i) => i.quality === target);
  if (exact?.url) return upgrade(exact.url);
  // Otherwise take the last entry, which the API orders largest-last.
  const last = images[images.length - 1];
  return last?.url ? upgrade(last.url) : FALLBACK_COVER;
}

/** Some URLs still carry a small size token; nudge them to 500x500. */
function upgrade(url: string): string {
  return url.replace('150x150', '500x500').replace('50x50', '500x500');
}

export const FALLBACK_COVER =
  'data:image/svg+xml,' +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='500' height='500'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#1a1a1a'/><stop offset='1' stop-color='#111'/></linearGradient></defs><rect width='500' height='500' fill='url(#g)'/><path d='M300 170v120a45 45 0 1 1-20-37V150l-90 22v140a45 45 0 1 1-20-37V150z' fill='#333'/></svg>`,
  );

/** Join artist names for a byline. Prefers primary credits. */
export function artistLine(song: Song): string {
  const list =
    song.artists?.primary?.length ? song.artists.primary : song.artists?.all || [];
  const names = list.map((a) => a.name).filter(Boolean);
  return names.length ? Array.from(new Set(names)).join(', ') : 'Unknown artist';
}

export function primaryArtist(song: Song): ArtistRef | undefined {
  return song.artists?.primary?.[0] || song.artists?.all?.[0];
}

export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function formatCount(n: number | null | undefined): string {
  if (!n || n < 0) return '';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

/**
 * Build an SEO-friendly slug segment from a title, then combine it with the id
 * as `slug-id`, matching the URL structure in the spec (/song/{slug}-{id}).
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/**
 * The slug and the id are joined with a *double* hyphen.
 *
 * `slugify` collapses every run of non-alphanumerics into a single `-` and trims
 * the ends, so a slug can never contain `--`. That makes the first `--` in the
 * path segment an unambiguous boundary. A single hyphen would not be: catalogue
 * ids come straight from upstream and are base64url-style tokens that can
 * themselves contain `-`, so splitting on the last hyphen silently truncated
 * those ids and the detail page 404'd.
 */
const SLUG_ID_SEPARATOR = '--';

export function entityHref(
  kind: 'song' | 'album' | 'artist' | 'playlist',
  name: string,
  id: string,
): string {
  if (kind === 'playlist') return `/playlist/${encodeURIComponent(id)}`;
  const slug = slugify(name);
  const segment = slug ? `${slug}${SLUG_ID_SEPARATOR}${id}` : id;
  return `/${kind}/${encodeURIComponent(segment)}`;
}

/**
 * Recover the id from a `slug--id` param. Splits on the *first* separator, so an
 * id containing `--` survives intact. A param with no separator is treated as a
 * bare id, which is what an entity with no name produces.
 */
export function idFromSlug(param: string): string {
  const at = param.indexOf(SLUG_ID_SEPARATOR);
  if (at === -1) return param;
  return param.slice(at + SLUG_ID_SEPARATOR.length);
}

export function isSong(item: Song | CollectionCard): item is Song {
  return item.type === 'song';
}

/**
 * Every rung the catalogue publishes, best first.
 *
 * All five are AAC in an MP4 container on the same CDN. There is no lossless
 * tier to request: no FLAC, ALAC or WAV variant exists, so 320 kbps is a real
 * ceiling rather than a setting, and offering a "lossless" option would only
 * mislabel the same AAC stream.
 */
const STREAM_RUNGS = ['320kbps', '160kbps', '96kbps', '48kbps', '12kbps'] as const;

/**
 * The rungs worth offering as a choice. The bottom two exist in the catalogue but
 * are only reached by stepping down, never by asking: they are there for a track
 * that publishes nothing better, not as something anyone would pick.
 */
export const STREAM_QUALITIES = ['320kbps', '160kbps', '96kbps'] as const;
export type StreamQuality = (typeof STREAM_QUALITIES)[number];

export const QUALITY_LABELS: Record<StreamQuality, { label: string; detail: string }> = {
  '320kbps': { label: 'High', detail: '320 kbps AAC, the best the catalogue offers' },
  '160kbps': { label: 'Balanced', detail: '160 kbps AAC, easier on a weak connection' },
  '96kbps': { label: 'Data saver', detail: '96 kbps AAC, lowest data use' },
};

export interface ChosenStream {
  url: string;
  /** The rung actually being played, which is not always the one requested. */
  quality: string;
  /** True when the track had nothing at the requested rung and had to drop. */
  steppedDown: boolean;
}

/**
 * Choose a stream for a song at, or as close as possible to, the requested rung.
 *
 * Steps down when the requested rung is missing for this track, and steps up if
 * only better ones exist, so a track is never rejected for lacking one specific
 * variant. Reports which rung was used so the interface can state what is
 * actually playing rather than what was asked for.
 */
export function pickStream(
  song: Song,
  requested: StreamQuality = '320kbps',
): ChosenStream | null {
  const urls = song.downloadUrl;
  if (!urls?.length) return null;

  const at = (quality: string) => urls.find((u) => u.quality === quality && u.url)?.url;
  const requestedIndex = STREAM_RUNGS.indexOf(requested as (typeof STREAM_RUNGS)[number]);
  const start = requestedIndex === -1 ? 0 : requestedIndex;

  // Down from the requested rung first: a lower bitrate is a compromise the
  // listener asked to tolerate, a higher one costs them data they did not.
  for (let i = start; i < STREAM_RUNGS.length; i++) {
    const url = at(STREAM_RUNGS[i]);
    if (url) return { url, quality: STREAM_RUNGS[i], steppedDown: i > start };
  }
  for (let i = start - 1; i >= 0; i--) {
    const url = at(STREAM_RUNGS[i]);
    if (url) return { url, quality: STREAM_RUNGS[i], steppedDown: false };
  }

  // An unrecognised quality tag: take the last entry, which the API orders
  // highest-last, rather than treating the track as unplayable.
  const last = urls[urls.length - 1];
  return last?.url ? { url: last.url, quality: last.quality || 'unknown', steppedDown: false } : null;
}

/** Time-based greeting for the home hero. */
export function greeting(date = new Date()): string {
  const h = date.getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}
