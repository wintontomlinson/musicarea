import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { api } from '@/lib/api';
import type { MoodSet } from '@/lib/types';
import { TrackList } from '@/components/sections/TrackList';
import { CollectionActions } from '@/components/player/CollectionActions';
import { CollectionMenu } from '@/components/collections/CollectionMenu';
import { EmptyState } from '@/components/ui/EmptyState';
import { SITE } from '@/lib/config';
import { formatDuration } from '@/lib/utils';

export const revalidate = 300;

async function getMood(id: string): Promise<MoodSet | null> {
  try {
    return await api.mood(id);
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const set = await getMood(params.id);
  if (!set?.mood) return { title: 'Mood not found' };
  return {
    title: `${set.mood.name} music`,
    description: `Listen to a ${set.mood.name.toLowerCase()} selection on ${SITE.name}.`,
    alternates: { canonical: `/mood/${params.id}` },
  };
}

export default async function MoodPage({ params }: { params: { id: string } }) {
  const set = await getMood(params.id);
  if (!set) notFound();
  if (!set.mood) {
    return (
      <div className="page page-stack">
        <EmptyState
          title="That mood is unavailable"
          message="Pick another mood to keep listening."
          ctaHref="/explore"
          ctaLabel="Browse moods"
        />
      </div>
    );
  }

  const songs = set.items ?? [];
  const totalSeconds = songs.reduce((sum, song) => sum + (song.duration || 0), 0);

  return (
    <div className="page page-stack">
      <header>
        <p className="t-micro">Mood</p>
        <h1 className="mt-2 t-display">{set.mood.name}</h1>
        {songs.length > 0 && (
          <p className="mt-2 t-meta">
            {songs.length} {songs.length === 1 ? 'song' : 'songs'}
            {totalSeconds ? ` · ${formatDuration(totalSeconds)}` : ''}
          </p>
        )}
        {songs.length > 0 && (
          <div className="mt-6">
            <CollectionActions songs={songs}>
              <CollectionMenu
                title={set.mood.name}
                path={`/mood/${params.id}`}
                songs={songs}
              />
            </CollectionActions>
          </div>
        )}
      </header>

      {songs.length ? (
        <TrackList songs={songs} />
      ) : (
        <EmptyState
          title="Nothing available"
          message="This mood has no playable tracks right now."
          ctaHref="/explore"
          ctaLabel="Browse moods"
        />
      )}
    </div>
  );
}
