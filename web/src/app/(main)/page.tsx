import type { Metadata } from 'next';
import { api } from '@/lib/api';
import type { BrowseData, FeedData, Row } from '@/lib/types';
import { EmptyState } from '@/components/ui/EmptyState';
import { SITE } from '@/lib/config';
import { preferredLanguages } from '@/lib/languages';
import { HomeExperience } from '@/components/home/HomeExperience';

export const metadata: Metadata = {
  title: `${SITE.name} · Discover and stream music`,
  description: SITE.description,
  alternates: { canonical: '/' },
};

/**
 * Home, as a server shell around a client experience.
 *
 * The server's job is to produce real content on the first paint: editorial shelves for
 * the listener's languages, plus a cold-start feed. That keeps the page indexable and
 * means there is never a skeleton on arrival.
 *
 * Personalisation cannot happen here. The history that drives it is in localStorage, so
 * `HomeExperience` re-requests the feed on the client once that has hydrated. Both
 * requests are kept because losing the server pass would trade a working first paint
 * for a loading state.
 */
export default async function HomePage() {
  const languages = await preferredLanguages();

  // Settled rather than awaited together: the editorial shelves and the feed fail
  // independently, and one being down is not a reason to show nothing.
  const [browseRes, feedRes] = await Promise.allSettled([
    api.browse(languages),
    api.feed({ history: [], languages, limit: 12 }),
  ]);

  const browse: BrowseData | null = browseRes.status === 'fulfilled' ? browseRes.value : null;
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

  const browseRows: Row[] = (browse?.rows ?? []).map((row) =>
    // Trending is capped at 24 items server-side, so the row is a sample rather than the
    // whole shelf. Explore is where the full set lives.
    row.id === 'trending' ? { ...row, showAll: '/explore' } : row,
  );

  return (
    <HomeExperience
      browseRows={browseRows}
      initialFeedRows={(feed?.rows ?? []).filter((row) => row.items?.length)}
      moods={browse?.moods ?? []}
      languages={languages}
    />
  );
}
