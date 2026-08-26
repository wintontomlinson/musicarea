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
export const revalidate = 300;

export default async function HomePage() {
  const languages = preferredLanguages();
  const [browseRes, feedRes] = await Promise.allSettled([
    api.browse(languages),
    api.feed({ history: [], languages, limit: 12 }),
  ]);
  const browse: BrowseData | null = browseRes.status === 'fulfilled' ? browseRes.value : null;
  const feed: FeedData | null = feedRes.status === 'fulfilled' ? feedRes.value : null;

  if (!browse && !feed) {
    return <div className="px-4 sm:px-6"><EmptyState title="Could not reach the music service" message="The catalogue is momentarily unavailable. Check the API connection and refresh." ctaHref="/" ctaLabel="Try again" /></div>;
  }

  const hero = firstSong(feed?.rows) || firstSong(browse?.rows);
  const rows: Row[] = [];
  if (feed?.rows) rows.push(...feed.rows);
  if (browse?.rows) {
    for (const row of browse.rows) rows.push(row.id === 'trending' ? { ...row, showAll: '/explore' } : row);
  }

  return (
    <div className="app-page">
      <section>
        <p className="text-[14px] text-text-secondary">{greeting()}</p>
        <h1 className="mt-1 text-h2 font-extrabold tracking-[-0.04em] sm:text-h1">Listen now</h1>
        <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-text-secondary">New picks from the languages you selected. Start a song to build a listening queue.</p>
      </section>
      {hero && <Hero song={hero} />}
      {rows.map((row) => <Carousel key={`${row.id}-${row.title}`} row={row} />)}
      {browse?.moods && <MoodGrid moods={browse.moods} heading="Browse by mood" />}
    </div>
  );
}

function firstSong(rows?: Row[]): Song | undefined {
  if (!rows) return undefined;
  for (const row of rows) {
    for (const item of row.items) if (isSong(item)) return item;
  }
  return undefined;
}
