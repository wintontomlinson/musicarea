import type { MetadataRoute } from 'next';
import { api } from '@/lib/api';
import { SITE, DEFAULT_LANGUAGES } from '@/lib/config';
import { entityHref, isSong } from '@/lib/utils';

/**
 * Sitemap for the public, indexable routes.
 *
 * The static list alone described a four-page site while every song, album,
 * artist, playlist and mood page carried full metadata and JSON-LD that nothing
 * pointed a crawler at. Catalogue entries are pulled from the same browse
 * response the home and explore pages use, so the sitemap advertises whatever is
 * currently being promoted rather than a hand-maintained list.
 *
 * Private routes (`/settings`, `/library`, `/liked`, `/recent`) are omitted here
 * and disallowed in `robots.ts`; each also sets `robots: { index: false }`.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${SITE.url}/`, lastModified: now, changeFrequency: 'hourly', priority: 1 },
    { url: `${SITE.url}/explore`, lastModified: now, changeFrequency: 'hourly', priority: 0.9 },
    { url: `${SITE.url}/charts`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${SITE.url}/search`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
  ];

  // A sitemap must still be served if the catalogue is unreachable, so a failure
  // degrades to the static routes rather than breaking the response.
  let browse;
  try {
    browse = await api.browse([...DEFAULT_LANGUAGES]);
  } catch {
    return staticEntries;
  }

  const seen = new Set<string>();
  const dynamic: MetadataRoute.Sitemap = [];

  function add(path: string, priority: number, changeFrequency: 'daily' | 'weekly') {
    const url = `${SITE.url}${path}`;
    if (seen.has(url)) return;
    seen.add(url);
    dynamic.push({ url, lastModified: now, changeFrequency, priority });
  }

  for (const mood of browse.moods ?? []) {
    if (mood.id) add(`/mood/${encodeURIComponent(mood.id)}`, 0.7, 'weekly');
  }

  for (const row of browse.rows ?? []) {
    for (const item of row.items ?? []) {
      if (!item?.id || !item.name) continue;
      if (isSong(item)) {
        add(entityHref('song', item.name, item.id), 0.8, 'weekly');
      } else if (item.type === 'album' || item.type === 'playlist') {
        add(entityHref(item.type, item.name, item.id), 0.7, 'weekly');
      }
    }
  }

  return [...staticEntries, ...dynamic];
}
