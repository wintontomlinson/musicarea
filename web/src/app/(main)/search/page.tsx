import type { Metadata } from 'next';
import { Suspense } from 'react';
import { api } from '@/lib/api';
import type { Mood } from '@/lib/types';
import { SearchExperience } from '@/components/search/SearchExperience';
import { preferredLanguages } from '@/lib/languages';
import { Skeleton } from '@/components/ui/Skeleton';
import { SITE } from '@/lib/config';

export const metadata: Metadata = {
  title: 'Search',
  description: `Search songs, artists, albums and playlists on ${SITE.name}.`,
  alternates: { canonical: '/search' },
};

export const revalidate = 300;

export default async function SearchPage({ searchParams }: { searchParams: { q?: string } }) {
  // Genre tiles fill the pre-query state. Fetched on the server and cached.
  let moods: Mood[] = [];
  try {
    moods = (await api.browse(preferredLanguages())).moods ?? [];
  } catch {
    moods = [];
  }

  return (
    <Suspense fallback={<SearchFallback />}>
      <SearchExperience moods={moods} initialQuery={(searchParams.q ?? '').trim()} />
    </Suspense>
  );
}

function SearchFallback() {
  return (
    <div className="page page-stack">
      <Skeleton className="h-9 w-40" />
      <Skeleton className="-mt-6 h-12 w-full max-w-2xl rounded-sm" />
    </div>
  );
}
