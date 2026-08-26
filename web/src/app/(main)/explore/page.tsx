import type { Metadata } from 'next';
import { api } from '@/lib/api';
import { preferredLanguages } from '@/lib/languages';
import type { BrowseData, Row } from '@/lib/types';
import { Carousel } from '@/components/sections/Carousel';
import { MoodGrid } from '@/components/sections/MoodGrid';
import { EmptyState } from '@/components/ui/EmptyState';

export const metadata: Metadata = {
  title: 'Explore',
  description: 'Explore trending songs, new releases, charts, playlists and moods on MusicArea.',
  alternates: { canonical: '/explore' },
};
export const revalidate = 300;

export default async function ExplorePage() {
  let browse: BrowseData | null = null;
  try { browse = await api.browse(preferredLanguages()); } catch { browse = null; }

  if (!browse) {
    return <div className="app-page"><EmptyState title="Explore is taking a breather" message="The catalogue could not be reached right now. Please refresh and try again." ctaHref="/" ctaLabel="Back to Home" /></div>;
  }

  return (
    <div className="app-page">
      <section>
        <h1 className="text-h2 font-extrabold tracking-[-0.04em] sm:text-h1">Explore</h1>
        <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-text-secondary">Browse releases, playlists and songs from the catalogue in your selected languages.</p>
      </section>
      <MoodGrid moods={browse.moods} heading="Start with a mood" />
      {browse.rows.map((row) => <Carousel key={`${row.id}-${row.title}`} row={withExploreLinks(row)} />)}
    </div>
  );
}

function withExploreLinks(row: Row): Row {
  return row.id === 'charts' ? { ...row, showAll: '/charts' } : row;
}
