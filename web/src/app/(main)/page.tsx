import type { Metadata } from 'next';
import { api } from '@/lib/api';
import type { BrowseData, FeedData, Row, Song } from '@/lib/types';
import { greeting, isSong } from '@/lib/utils';
import { Hero } from '@/components/sections/Hero';
import { Carousel } from '@/components/sections/Carousel';
import { MoodGrid } from '@/components/sections/MoodGrid';
import { QuickAccess } from '@/components/sections/QuickAccess';
import { EmptyState } from '@/components/ui/EmptyState';
import { LanguagePreferenceLink } from '@/components/preferences/LanguagePreferenceLink';
import { SITE } from '@/lib/config';
import { preferredLanguages } from '@/lib/languages';

export const metadata: Metadata = {
  // Absolute, so the layout template does not append the brand a second time.
  title: { absolute: `${SITE.name} · Stream music, albums and playlists` },
  description: SITE.description,
  alternates: { canonical: '/' },
};

// Editorial shelves are cacheable. The cold-start feed is fetched per request
// because it depends on the listener's language cookie.
export const revalidate = 300;

export default async function HomePage() {
  const languages = preferredLanguages();

  // Either source can fail independently, so render whatever came back.
  const [browseResult, feedResult] = await Promise.allSettled([
    api.browse(languages),
    api.feed({ history: [], languages, limit: 12 }),
  ]);

  const browse: BrowseData | null =
    browseResult.status === 'fulfilled' ? browseResult.value : null;
  const feed: FeedData | null = feedResult.status === 'fulfilled' ? feedResult.value : null;

  if (!browse && !feed) {
    return (
      <div className="page page-stack">
        <EmptyState
          icon="wifiOff"
          title="Could not reach the music service"
          message="The catalogue is unavailable right now. Refresh once the connection is back."
          ctaHref="/"
          ctaLabel="Reload"
        />
      </div>
    );
  }

  const featured = firstSong(feed?.rows) ?? firstSong(browse?.rows);

  const shelves: Row[] = [];
  if (feed?.rows) shelves.push(...feed.rows);
  if (browse?.rows) {
    for (const row of browse.rows) {
      shelves.push(row.id === 'trending' ? { ...row, showAll: '/explore' } : row);
    }
  }

  return (
    <div className="page page-stack">
      <header>
        <p className="t-micro">{greeting()}</p>
        <h1 className="mt-2 t-display">Listen now</h1>
        <LanguagePreferenceLink />
      </header>

      {featured && <Hero song={featured} />}

      <QuickAccess />

      {shelves.map((row) => (
        <Carousel key={`${row.id}-${row.title}`} row={row} />
      ))}

      {browse?.moods && browse.moods.length > 0 && (
        <MoodGrid moods={browse.moods} heading="Browse by mood" headingId="home-moods" />
      )}
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
