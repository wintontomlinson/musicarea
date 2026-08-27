'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { m } from 'motion/react';
import type { HistoryEntry, MixCard, MixesData } from '@/lib/types';
import { usePlayer } from '@/stores/player';
import { pickImage } from '@/lib/utils';
import { useInView } from '@/hooks/useInView';
import { Icon } from '@/components/ui/Icon';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { staggerContainer, staggerItem } from '@/lib/motion';

/**
 * Personalised mixes, this app's answer to Discover Weekly and Release Radar.
 *
 * Named "Your mixes" rather than borrowing those names, which are Spotify products.
 * The content is genuinely generated per listener: `/api/mixes` builds each one from
 * the taste profile with its own recall pass, so an artist mix really is assembled
 * around that artist and the acts that share playlists with them.
 *
 * The request is deferred until the section scrolls into view. Each mix costs a
 * separate recall pass upstream and a cold response takes seconds, so firing it during
 * page load would spend the listener's first moments on a section below the fold. That
 * is also why there is a skeleton rather than nothing: the wait is real and worth
 * acknowledging.
 *
 * A mix has no page of its own (it exists only for the request that made it), so the
 * card plays rather than navigates. That is why the whole tile is a button here, where
 * the recently-played tiles are links.
 */
/** Only the settled outcomes are stored. Loading is derived, not recorded. */
type MixResult = { kind: 'ready'; mixes: MixCard[] } | { kind: 'empty' };

export function SmartPlaylistCards({ history }: { history: HistoryEntry[] }) {
  const { ref, inView } = useInView<HTMLElement>();
  const [result, setResult] = useState<MixResult | null>(null);
  const playQueue = usePlayer((state) => state.playQueue);

  // No history means the endpoint would answer with a cold-start result anyway, so the
  // request is skipped and the conclusion reached without a round trip.
  const noHistory = history.length === 0;

  /**
   * Loading is derived from "should be fetching and has no answer yet" rather than being
   * tracked as its own state. Recording it would mean setting state synchronously inside
   * the effect, which triggers a cascading render, and it would give two sources of truth
   * for one condition.
   */
  const shouldFetch = inView && !noHistory && result === null;

  useEffect(() => {
    if (!shouldFetch) return;

    // Aborting on cleanup is what makes this safe without a "still mounted" flag: an
    // aborted fetch rejects, so the success path cannot run against a gone component.
    const controller = new AbortController();

    fetch('/api/mixes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ history }),
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error('mixes failed');
        return res.json() as Promise<MixesData>;
      })
      .then((data) => {
        const usable = (data.mixes ?? []).filter((mix) => mix.items?.length);
        setResult(usable.length ? { kind: 'ready', mixes: usable } : { kind: 'empty' });
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return;
        // A failure and an empty result are shown the same way, because they mean the
        // same thing to the listener: there are no mixes to look at.
        setResult({ kind: 'empty' });
      });

    return () => controller.abort();
  }, [shouldFetch, history]);

  // Nothing is rendered when there is nothing to show. A section headed "Your mixes"
  // explaining that it has no mixes is worse than the section being absent: the listener
  // loses nothing, and Home has plenty else on it.
  if (noHistory || result?.kind === 'empty') return null;

  return (
    <section ref={ref} aria-labelledby="your-mixes">
      <div className="mb-4">
        <p className="section-kicker mb-1">Built for you</p>
        <h2 id="your-mixes" className="section-title">
          Your mixes
        </h2>
        <p className="mt-1 text-[13px] text-text-secondary">
          Generated from what you have played, refreshed as your taste moves.
        </p>
      </div>

      {result?.kind === 'ready' ? (
        <m.ul
          variants={staggerContainer}
          initial="hidden"
          animate="show"
          className="no-scrollbar -mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 sm:-mx-8 sm:px-8 lg:-mx-10 lg:px-10"
        >
          {result.mixes.map((mix) => (
            <m.li
              key={mix.id}
              variants={staggerItem}
              className="w-[10.5rem] shrink-0 snap-start sm:w-[12rem] lg:w-[13.5rem]"
            >
              <button
                type="button"
                onClick={() => playQueue(mix.items, 0)}
                className="group block w-full text-left"
              >
                <span className="relative block aspect-square overflow-hidden rounded-card border border-white/10 bg-surface-raised shadow-lift transition duration-300 group-hover:-translate-y-1 group-hover:border-accent-soft/45 group-hover:shadow-glow">
                  <MixArtwork mix={mix} />
                  <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 pt-8">
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white/85">
                      <Icon name="sparkle" size={11} />
                      Mix
                    </span>
                  </span>
                  <span
                    aria-hidden="true"
                    className="absolute bottom-2.5 right-2.5 grid h-10 w-10 translate-y-2 place-items-center rounded-full bg-brand text-on-accent opacity-0 shadow-glow transition duration-300 group-hover:translate-y-0 group-hover:opacity-100"
                  >
                    <Icon name="play" size={15} />
                  </span>
                </span>
                <span className="mt-2.5 block truncate text-[14px] font-bold leading-tight">
                  {mix.name}
                </span>
                <span className="mt-1 block truncate text-[12px] leading-tight text-text-secondary">
                  {mix.subtitle || `${mix.songCount} tracks`}
                </span>
              </button>
            </m.li>
          ))}
        </m.ul>
      ) : (
        <div className="no-scrollbar -mx-4 flex gap-4 overflow-hidden px-4 sm:-mx-8 sm:px-8 lg:-mx-10 lg:px-10">
          {Array.from({ length: 5 }, (_, index) => (
            <SkeletonCard key={index} className="w-[10.5rem] shrink-0 sm:w-[12rem] lg:w-[13.5rem]" />
          ))}
        </div>
      )}
    </section>
  );
}

/**
 * Four-cover collage, falling back to a single cover.
 *
 * The recommender already returns `covers` (the artwork of the first four tracks) and,
 * like `Mood.hue`, nothing had ever used it. A collage is the right treatment because a
 * mix has no cover art of its own, and borrowing one track's sleeve would misrepresent
 * it as that artist's record.
 */
function MixArtwork({ mix }: { mix: MixCard }) {
  const covers = (mix.covers ?? [])
    .map((entry) => (entry ? pickImage(entry, '150x150') : null))
    .filter((url): url is string => !!url);

  if (covers.length < 4) {
    return (
      <Image
        src={pickImage(mix.image ?? undefined)}
        alt=""
        fill
        sizes="(max-width: 640px) 45vw, 216px"
        className="object-cover transition duration-500 group-hover:scale-105"
      />
    );
  }

  return (
    <span className="absolute inset-0 grid grid-cols-2 grid-rows-2">
      {covers.slice(0, 4).map((url, index) => (
        <span key={index} className="relative">
          <Image src={url} alt="" fill sizes="108px" className="object-cover" />
        </span>
      ))}
    </span>
  );
}
