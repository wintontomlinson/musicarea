import type { SearchResult } from '@/lib/types';
import { entityHref, pickImage } from '@/lib/utils';

/** The detail-page href for a search result, by its type. */
export function resultHref(r: SearchResult): string {
  switch (r.type) {
    case 'artist':
      return entityHref('artist', r.title, r.id);
    case 'album':
      return entityHref('album', r.title, r.id);
    case 'playlist':
      return entityHref('playlist', r.title, r.id);
    case 'song':
      return entityHref('song', r.title, r.id);
    default:
      return '/';
  }
}

export function resultImage(r: SearchResult): string {
  return pickImage(r.image, r.type === 'artist' ? '150x150' : '500x500');
}

/** A muted subtitle line for a result, decoded from its loose fields. */
export function resultSubtitle(r: SearchResult): string {
  if (r.type === 'artist') return 'Artist';
  const label = r.type.charAt(0).toUpperCase() + r.type.slice(1);
  const by = r.primaryArtists || r.singers || '';
  return by ? `${label} · ${decodeEntities(by)}` : label;
}

/** The API occasionally returns HTML entities in text fields. */
export function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}
