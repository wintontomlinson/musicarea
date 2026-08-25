import type { Metadata } from 'next';
import { Suspense } from 'react';
import { api } from '@/lib/api';
import type { Mood } from '@/lib/types';
import { SearchExperience } from '@/components/search/SearchExperience';
import { preferredLanguages } from '@/lib/languages';

export const metadata: Metadata = {
  title: 'Search',
  description: 'Search millions of songs, artists, albums and playlists on MusicArea.',
  alternates: { canonical: '/search' },
};

export const revalidate = 300;

export default async function SearchPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  // Moods power the before-typing state; fetched on the server and cached.
  let moods: Mood[] = [];
  try {
    const browse = await api.browse(preferredLanguages());
    moods = browse.moods ?? [];
  } catch {
    moods = [];
  }
  const initialQuery = (searchParams.q ?? '').trim();

  return (
    <Suspense fallback={<div className="p-6 text-sm text-text-secondary">Loading search…</div>}>
      <SearchExperience moods={moods} initialQuery={initialQuery} />
    </Suspense>
  );
}
