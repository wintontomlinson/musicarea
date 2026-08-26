import type { Metadata } from 'next';
import { api } from '@/lib/api';
import { preferredLanguages } from '@/lib/languages';
import type { BrowseData, Row } from '@/lib/types';
import { Carousel } from '@/components/sections/Carousel';
import { MoodGrid } from '@/components/sections/MoodGrid';
import { EmptyState } from '@/components/ui/EmptyState';
import { SITE } from '@/lib/config';

export const metadata: Metadata = {
  title: 'Explore',
  description: `Browse trending songs, new releases, albums, playlists and moods on ${SITE.name}.`,
  alternates: { canonical: '/explore' },
};

export const revalidate = 300;

/**
 * Explore leads with categories rather than a featured release, so it reads as
 * a browsing surface and does not repeat the Home layout.
 */
export default async function ExplorePage() {
  let browse: BrowseData | null = null;
  try {
    browse = await api.browse(preferredLanguages());
  } catch {
    browse = null;
  }

  if (!browse) {
    return (
      <div className="page page-stack">
        <EmptyState
          icon="wifiOff"
          title="Explore is unavailable"
          message="The catalogue could not be reached. Try again in a moment."
          ctaHref="/"
          ctaLabel="Back to Home"
        />
      </div>
    );
  }

  return (
    <div className="page page-stack">
      <header>
        <h1 className="t-display">Explore</h1>
        <p className="mt-2.5 max-w-xl text-body leading-relaxed text-text-secondary">
          Songs, albums and playlists from the catalogue, in the languages you selected.
        </p>
      </header>

      {browse.moods.length > 0 && (
        <MoodGrid moods={browse.moods} heading="Moods" headingId="explore-moods" />
      )}

      {browse.rows.map((row) => (
        <Carousel key={`${row.id}-${row.title}`} row={withDestination(row)} />
      ))}
    </div>
  );
}

/** Point editorial rows at the surface that shows the whole set. */
function withDestination(row: Row): Row {
  if (row.id === 'charts') return { ...row, showAll: '/charts' };
  return row;
}
