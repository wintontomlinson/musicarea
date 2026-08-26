import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { api } from '@/lib/api';
import { loadEntity } from '@/lib/entity';
import type { MoodSet } from '@/lib/types';
import { TrackList } from '@/components/sections/TrackList';
import { CollectionActions } from '@/components/player/CollectionActions';
import { EmptyState } from '@/components/ui/EmptyState';
import { EntityUnavailable, unavailableMetadata } from '@/components/ui/EntityUnavailable';
import { Icon } from '@/components/ui/Icon';
import { ThemeCover } from '@/components/theme/ThemeCover';
import { pickImage } from '@/lib/utils';

export const revalidate = 300;

/**
 * A mood id is one of a fixed catalogue-side list, so an unknown id is a genuine
 * 404 while a failed request is an availability problem. The API answers with
 * `{ mood: null, items: [] }` for an id it does not recognise, which is what
 * `present` checks for.
 */
function getMood(id: string) {
  return loadEntity(
    () => api.mood(id),
    (set): set is MoodSet & { mood: NonNullable<MoodSet['mood']> } => !!set?.mood,
  );
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const result = await getMood((await params).id);
  if (result.status === 'unavailable') return unavailableMetadata('mood');
  if (result.status === 'missing') return { title: 'Mood not found', robots: { index: false } };
  const { mood } = result.data;
  return {
    title: `${mood.name} music`,
    description: `Listen to the ${mood.name} music selection on MusicArea.`,
  };
}

export default async function MoodPage({ params }: { params: Promise<{ id: string }> }) {
  const result = await getMood((await params).id);
  if (result.status === 'unavailable') return <EntityUnavailable kind="mood" />;
  if (result.status === 'missing') notFound();
  const set = result.data;

  // A mood has no sleeve of its own, so its own cover art is used when the
  // catalogue supplies one and the opening track stands in for it otherwise.
  const themeCover = set.mood.image || (set.items[0] ? pickImage(set.items[0].image) : null);

  return (
    <div className="app-page">
      {themeCover && <ThemeCover cover={themeCover} />}
      <section className="disco-panel p-6 sm:p-8">
        <p className="section-kicker">Mood station</p>
        <h1 className="mt-2 text-h2 font-extrabold tracking-[-0.04em] sm:text-h1">
          {set.mood.name}
          <span className="headline-gradient">.</span>
        </h1>
        <p className="mt-3 max-w-xl text-[15px] text-white/70">
          A catalogue-led selection for this moment. Start anywhere and keep the room moving.
        </p>
        <div className="mt-6">
          <CollectionActions songs={set.items} />
        </div>
      </section>

      {set.items.length ? (
        <section>
          <div className="mb-4 flex items-end justify-between">
            <div>
              <p className="section-kicker mb-1">Station queue</p>
              <h2 className="section-title">{set.items.length} tracks</h2>
            </div>
            <span className="inline-flex items-center gap-1.5 text-[12px] text-text-secondary">
              <Icon name="disc" size={15} className="text-accent-soft" />
              Catalogue order
            </span>
          </div>
          <div className="premium-panel p-2 sm:p-3">
            <TrackList songs={set.items} />
          </div>
        </section>
      ) : (
        <EmptyState
          title="No tracks are available"
          message="This mood has no playable music right now."
          ctaHref="/explore"
          ctaLabel="Explore moods"
        />
      )}
    </div>
  );
}
