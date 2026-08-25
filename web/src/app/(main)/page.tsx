import type { Metadata } from 'next';
import { api } from '@/lib/api';
import type { BrowseData, FeedData, Row, Song } from '@/lib/types';
import { isSong, greeting } from '@/lib/utils';
import { Hero } from '@/components/sections/Hero';
import { Carousel } from '@/components/sections/Carousel';
import { MoodGrid } from '@/components/sections/MoodGrid';
import { EmptyState } from '@/components/ui/EmptyState';
import { SITE } from '@/lib/config';
import { preferredLanguages } from '@/lib/languages';

export const metadata: Metadata = {
  title: `${SITE.name} · Discover and stream music`,
  description: SITE.description,
  alternates: { canonical: '/' },
};

// Editorial content is cacheable; the personalized cold-start feed is fetched
// fresh. Revalidate the page every 5 minutes.
export const revalidate = 300;

export default async function HomePage() {
  const languages = preferredLanguages();
  // Fetch editorial browse and a cold-start feed in parallel. Either can fail
  // independently (the API may be unreachable); we render whatever we get.
  const [browseRes, feedRes] = await Promise.allSettled([
    api.browse(languages),
    api.feed({ history: [], languages, limit: 12 }),
  ]);

  const browse: BrowseData | null =
    browseRes.status === 'fulfilled' ? browseRes.value : null;
  const feed: FeedData | null = feedRes.status === 'fulfilled' ? feedRes.value : null;

  if (!browse && !feed) {
    return (
      <div className="px-4 sm:px-6">
        <EmptyState
          title="Could not reach the music service"
          message="The catalogue is momentarily unavailable. Check the API connection and refresh."
          ctaHref="/"
          ctaLabel="Try again"
        />
      </div>
    );
  }

  // Pick a hero track: the first song in the feed, else the first browse song.
  const hero = firstSong(feed?.rows) || firstSong(browse?.rows);

  // Compose the shelves: personalized feed rows first, then editorial rows,
  // with the trending row linking through to Explore.
  const rows: Row[] = [];
  if (feed?.rows) rows.push(...feed.rows);
  if (browse?.rows) {
    for (const row of browse.rows) {
      rows.push(row.id === 'trending' ? { ...row, showAll: '/explore' } : row);
    }
  }

  return (
    <div className="app-page">
      {/* Apple Music titles Listen Now with the time-of-day greeting. */}
      <h1 className="text-h2 font-bold tracking-tight sm:text-h1">{greeting()}</h1>
      {hero && <Hero song={hero} />}
      {rows.map((row) => (
        <Carousel key={`${row.id}-${row.title}`} row={row} />
      ))}
      {browse?.moods && <MoodGrid moods={browse.moods} />}
    </div>
  );
}

function firstSong(rows?: Row[]): Song | undefined {
  if (!rows) return undefined;
  for (const row of rows) {
    for (const item of row.items) {
      if (isSong(item)) return item;
    }
  }
  return undefined;
}
