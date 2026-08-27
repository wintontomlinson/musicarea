import type { Metadata } from 'next';
import { api } from '@/lib/api';
import type { Row, Song } from '@/lib/types';
import { isSong } from '@/lib/utils';
import { preferredLanguages } from '@/lib/languages';
import { SamplesFeed } from '@/components/samples/SamplesFeed';

export const metadata: Metadata = {
  title: 'Samples',
  description: 'Preview thirty seconds of tracks picked for you, one swipe at a time.',
  alternates: { canonical: '/samples' },
};

/** Enough to scroll through without the page carrying a hundred images it will never show. */
const FEED_LIMIT = 24;

/**
 * The samples feed.
 *
 * Server-rendered from the editorial shelves rather than the personalised feed. That is deliberate:
 * a preview reel is for discovery, and the recommender's output is weighted toward what the listener
 * already leans on. Trending and just-released give a wider spread, which is the point of the format.
 *
 * Note the tracks must carry stream URLs, which browse rows do. A feed built from stored library
 * records would not work here: those are slimmed of their `downloadUrl` before being persisted.
 */
export default async function SamplesPage() {
  let rows: Row[] = [];
  try {
    const browse = await api.browse(await preferredLanguages());
    rows = browse.rows ?? [];
  } catch {
    rows = [];
  }

  return <SamplesFeed songs={collectSongs(rows)} />;
}

function collectSongs(rows: Row[]): Song[] {
  const out: Song[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (row.kind !== 'songs') continue;
    for (const item of row.items) {
      if (!isSong(item) || seen.has(item.id)) continue;
      // A track with no stream cannot be previewed, and a silent card in a preview reel reads as a
      // broken app rather than as missing data.
      if (!item.downloadUrl?.length) continue;
      seen.add(item.id);
      out.push(item);
      if (out.length >= FEED_LIMIT) return out;
    }
  }
  return out;
}
