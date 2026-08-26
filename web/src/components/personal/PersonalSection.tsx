'use client';

import { usePersonalFeed, useMixes } from '@/hooks/usePersonalised';
import { Carousel } from '@/components/sections/Carousel';
import { MixCard } from './MixCard';
import { TasteMeter } from './TasteMeter';

/**
 * The personalised half of the home page.
 *
 * Client rendered on purpose. The recommender keeps no accounts and no database:
 * it rebuilds the listening profile on every request from a log held in the
 * browser, so the request has to originate here. The server-rendered editorial
 * shelves below it stay on the server, where they are good for first paint and
 * for crawlers, and neither depends on the other.
 */
export function PersonalSection() {
  const feed = usePersonalFeed();
  const profile = feed.data?.profile ?? null;

  // Mixes are only worth asking for once the profile can support them. With a
  // cold profile the endpoint always answers with an empty list, and it shares a
  // small rate-limit budget with the feed.
  const warm = !!profile && !profile.coldStart;
  const mixes = useMixes(warm);
  const mixList = mixes.data?.mixes ?? [];

  if (!feed.ready) return null;

  const rows = feed.data?.rows ?? [];

  return (
    <div className="flex flex-col gap-8">
      <TasteMeter profile={profile} />

      {feed.loading && rows.length === 0 && (
        <p className="text-[13px] text-text-secondary">Working out what to play you…</p>
      )}

      {feed.rateLimited && rows.length === 0 && (
        <p className="text-[13px] text-text-secondary">
          The recommender is busy right now. The shelves below are still live, and your
          picks will be back in a moment.
        </p>
      )}

      {/* Generated mixes sit above the shelves: they are the densest thing here,
          one tile standing in for a whole listening session. */}
      {mixList.length > 0 && (
        <section>
          <div className="mb-4">
            <p className="section-kicker mb-1">Made for you</p>
            <h2 className="section-title">Your mixes</h2>
            <p className="mt-1 text-[13px] text-text-secondary">
              Built from your listening. Each one is a different slice of it.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {mixList.map((mix) => (
              <MixCard key={mix.id} mix={mix} />
            ))}
          </div>
        </section>
      )}

      {rows.map((row) => (
        <Carousel key={row.id} row={row} />
      ))}
    </div>
  );
}
