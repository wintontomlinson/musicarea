import type { Metadata } from 'next';
import { Suspense } from 'react';
import { api } from '@/lib/api';
import type { BrowseData, Mood, Row } from '@/lib/types';
import { SearchExperience } from '@/components/search/SearchExperience';
import { preferredLanguages } from '@/lib/languages';
import { isSong, primaryArtist } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Search',
  description: 'Search millions of songs, artists, albums and playlists on MusicArea.',
  alternates: { canonical: '/search' },
};

/** How many trending suggestions to offer. Enough to fill two rows of chips, not more. */
const TRENDING_LIMIT = 10;

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  // The browse shelves power both the idle-state mood tiles and the trending suggestions.
  // Fetched on the server and cached, so the idle state is instant.
  let browse: BrowseData | null = null;
  try {
    browse = await api.browse(await preferredLanguages());
  } catch {
    browse = null;
  }

  const moods: Mood[] = browse?.moods ?? [];
  const initialQuery = ((await searchParams).q ?? '').trim();

  return (
    <Suspense fallback={<div className="p-6 text-sm text-text-secondary">Loading search…</div>}>
      <SearchExperience
        moods={moods}
        trending={trendingQueries(browse?.rows ?? [])}
        initialQuery={initialQuery}
      />
    </Suspense>
  );
}

/**
 * Suggested searches, derived from the catalogue's trending shelf.
 *
 * There is no trending-queries endpoint in this API, and a hardcoded list would be stale within
 * a week of shipping. Artist names from the trending songs are the closest honest substitute:
 * they are current, they come from the listener's own languages, and they are the kind of thing
 * someone would actually type.
 *
 * Artists rather than song titles, because a title is usually a search with exactly one useful
 * result, whereas an artist name opens a whole catalogue. Titles are used only to top up when
 * there are too few distinct artists.
 */
function trendingQueries(rows: Row[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  const add = (value: string | undefined | null) => {
    const trimmed = value?.trim();
    if (!trimmed || trimmed.length < 2) return;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(trimmed);
  };

  const songRows = rows.filter((row) => row.kind === 'songs');

  for (const row of songRows) {
    for (const item of row.items) {
      if (!isSong(item)) continue;
      add(primaryArtist(item)?.name);
      if (out.length >= TRENDING_LIMIT) return out;
    }
  }

  // Topped up with titles only if the shelves were dominated by a handful of artists.
  for (const row of songRows) {
    for (const item of row.items) {
      if (!isSong(item)) continue;
      add(item.name);
      if (out.length >= TRENDING_LIMIT) return out;
    }
  }

  return out;
}
