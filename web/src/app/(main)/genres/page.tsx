import type { Metadata } from 'next';
import { api } from '@/lib/api';
import { preferredLanguages } from '@/lib/languages';
import { MoodGrid } from '@/components/sections/MoodGrid';
import { EmptyState } from '@/components/ui/EmptyState';
import { SITE } from '@/lib/config';
import type { Mood } from '@/lib/types';

export const metadata: Metadata = {
  title: 'Genres',
  description: `Browse music by genre and mood on ${SITE.name}.`,
  alternates: { canonical: '/genres' },
};

export const revalidate = 3600;

export default async function GenresPage() {
  let moods: Mood[] = [];
  try {
    moods = (await api.browse(preferredLanguages())).moods ?? [];
  } catch {
    moods = [];
  }

  return (
    <div className="page page-stack">
      <header>
        <h1 className="t-display">Genres</h1>
        <p className="mt-2.5 max-w-xl text-body leading-relaxed text-text-secondary">
          Every category the catalogue publishes. Open one for a ready-made set of tracks.
        </p>
      </header>

      {moods.length ? (
        <MoodGrid moods={moods} heading="All genres" headingId="all-genres" />
      ) : (
        <EmptyState
          icon="wifiOff"
          title="Genres are unavailable"
          message="The catalogue could not be reached. Try again in a moment."
          ctaHref="/explore"
          ctaLabel="Explore instead"
        />
      )}
    </div>
  );
}
