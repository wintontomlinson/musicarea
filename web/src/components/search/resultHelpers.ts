import type { SearchResult } from '@/lib/types';
import { decodeEntities, entityHref, pickImage } from '@/lib/utils';

// Re-exported so existing call sites keep working now that the implementation has
// moved to `lib/utils`, where the lyrics layer can reach it too.
export { decodeEntities };

/** The detail-page href for a search result, by its type. */
export function resultHref(r: SearchResult): string {
  const title = typeof r.title === 'string' ? r.title : '';
  switch (r.type) {
    case 'artist':
    case 'album':
    case 'playlist':
    case 'song':
      return entityHref(r.type, title, r.id);
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
  const label = typeof r.type === 'string' && r.type ? r.type.charAt(0).toUpperCase() + r.type.slice(1) : 'Result';
  const by = r.primaryArtists || r.singers || '';
  return by ? `${label} · ${decodeEntities(by)}` : label;
}


