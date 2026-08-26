'use client';

import { useEffect } from 'react';
import { useHistory } from '@/stores/history';
import type { FeedProfile } from '@/lib/types';

/**
 * How much the recommender has to work with.
 *
 * `strength` is the decayed weight of positive listening events over 25, so it
 * rises as someone listens and falls again if they stop. The server's own figure
 * is used when a feed response is available; before that the store computes the
 * same formula locally, so the bar is populated on first paint rather than
 * reading zero for an established listener.
 */
export function TasteMeter({ profile }: { profile: FeedProfile | null }) {
  const hydrate = useHistory((s) => s.hydrate);
  const hydrated = useHistory((s) => s.hydrated);
  const localStrength = useHistory((s) => s.strength());
  const events = useHistory((s) => s.entries.length);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const strength = profile ? profile.strength : localStrength;
  const signals = profile ? profile.events : events;
  const pct = Math.round(Math.max(0, Math.min(1, strength)) * 100);

  if (!hydrated) return null;

  const topArtists = (profile?.topArtists ?? []).map((a) => a.name).filter(Boolean).slice(0, 3);

  return (
    <div className="rounded-card border border-white/10 bg-white/[0.03] p-4">
      {/* Wraps as whole items rather than breaking the stat mid-phrase, which on a
          360px screen left "signals" orphaned on its own line. */}
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="section-kicker">Your taste profile</p>
        <p className="whitespace-nowrap text-[12px] tabular-nums text-text-secondary">
          {signals ? `${pct}% from ${signals} ${signals === 1 ? 'signal' : 'signals'}` : 'Listening to learn'}
        </p>
      </div>
      <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-brand transition-[width] duration-700 ease-smooth"
          style={{ width: `${Math.max(pct, signals ? 4 : 0)}%` }}
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Taste profile strength"
        />
      </div>
      <p className="mt-2 text-[12px] leading-relaxed text-text-secondary">
        {topArtists.length
          ? `Built from your listening, led by ${topArtists.join(', ')}.`
          : 'Play a few tracks and the recommendations below start shaping to you.'}
      </p>
    </div>
  );
}
