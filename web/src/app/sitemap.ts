import type { MetadataRoute } from 'next';
import { SITE } from '@/lib/config';

/**
 * Static sitemap for the public, indexable routes that exist in Phase 1. As
 * catalogue detail pages (song/album/artist) land in later phases, this will be
 * extended with dynamic entries for popular content.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const routes = ['', '/search', '/explore', '/charts'];
  return routes.map((path) => ({
    url: `${SITE.url}${path}`,
    lastModified: now,
    changeFrequency: 'daily',
    priority: path === '' ? 1 : 0.7,
  }));
}
