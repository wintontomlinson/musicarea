import type { Metadata } from 'next';
import { api } from '@/lib/api';
import type { BrowseData, Row, Song } from '@/lib/types';
import { isSong, greeting } from '@/lib/utils';
import { Hero } from '@/components/sections/Hero';
import { Carousel } from '@/components/sections/Carousel';
import { MoodGrid } from '@/components/sections/MoodGrid';
import { EmptyState } from '@/components/ui/EmptyState';
import { SITE } from '@/lib/config';
import { preferredLanguages } from '@/lib/languages';
import { PersonalSection } from '@/components/personal/PersonalSection';
import { Icon } from '@/components/ui/Icon';

export const metadata: Metadata = {
  title: `${SITE.name} · Discover and stream music`,
  description: SITE.description,
  alternates: { canonical: '/' },
};

/**
 * Home is deliberately split in two.
 *
 * The editorial shelves are fetched here, on the server: they are the same for
 * everyone, so they cache well, paint first and give crawlers something real.
 * The personalised shelves cannot be, because the recommender rebuilds its
 * profile from a listening log that only the browser has. This page used to call
 * the feed endpoint server side with `history: []`, which meant every visitor got
 * an identical cold-start response and four of its five shelves were never even
 * emitted. That request is gone; `PersonalSection` makes the real one.
 */
export default async function HomePage() {
  let browse: BrowseData | null = null;
  try {
    browse = await api.browse(await preferredLanguages());
  } catch {
    browse = null;
  }

  if (!browse) {
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

  const hero = firstSong(browse.rows);
  const rows: Row[] = browse.rows.map((row) =>
    row.id === 'trending' ? { ...row, showAll: '/explore' } : row,
  );

  return (
    <div className="app-page">
      <section className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="section-kicker">MusicArea presents</p>
          <h1 className="mt-2 text-h2 font-extrabold tracking-[-0.04em] sm:text-h1">
            {greeting()}, <span className="headline-gradient">let&apos;s move.</span>
          </h1>
          <p className="mt-2 max-w-xl text-[15px] text-text-secondary">
            Your selected languages set the scene. Choose a song and keep the queue going.
          </p>
        </div>
        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-fuchsia-300/25 bg-fuchsia-400/10 px-3 py-1.5 text-[12px] font-bold text-accent-soft">
          <Icon name="disc" size={15} />
          Turn up your world
        </div>
      </section>

      {hero && <Hero song={hero} />}

      <PersonalSection />

      {rows.map((row) => (
        <Carousel key={`${row.id}-${row.title}`} row={row} />
      ))}

      {browse.moods && <MoodGrid moods={browse.moods} heading="Pick a mood and press play" />}
    </div>
  );
}

function firstSong(rows?: Row[]): Song | undefined {
  if (!rows) return undefined;
  for (const row of rows) {
    for (const item of row.items) {
      if (isSong(item)) return item;
    }
  }
  return undefined;
}
