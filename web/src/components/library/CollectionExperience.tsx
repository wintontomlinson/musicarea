'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import type { Song } from '@/lib/types';
import { useLibrary } from '@/stores/library';
import { TrackList } from '@/components/sections/TrackList';
import { CollectionActions } from '@/components/player/CollectionActions';
import { Icon, type IconName } from '@/components/ui/Icon';

/**
 * Shared screen for the two stored collections, Favourites and Recently played.
 * Both are the same shape: a header, bulk play actions, a track list and a way
 * to empty it. Only the source list and the copy differ.
 *
 * Everything here comes from localStorage, so the list is read after mount. The
 * markup is identical on the server and the first client render (the store
 * starts empty and `hydrated` is false), which keeps hydration clean; the
 * placeholder below covers the gap.
 */
export function CollectionExperience({
  kind,
  icon,
  intro,
  source,
}: {
  kind: string;
  icon: Extract<IconName, 'heart' | 'clock'>;
  intro: string;
  source: 'liked' | 'recent';
}) {
  const hydrate = useLibrary((s) => s.hydrate);
  const hydrated = useLibrary((s) => s.hydrated);
  const songs: Song[] = useLibrary((s) => (source === 'liked' ? s.liked : s.recent));
  const clearLiked = useLibrary((s) => s.clearLiked);
  const clearRecent = useLibrary((s) => s.clearRecent);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const clear = source === 'liked' ? clearLiked : clearRecent;

  return (
    <div className="app-page">
      <section className="disco-panel p-6 sm:p-8">
        <p className="section-kicker">Your collection</p>
        <h1 className="mt-2 text-h2 font-extrabold tracking-[-0.04em] sm:text-h1">
          {kind}
          <span className="headline-gradient">.</span>
        </h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-white/70">{intro}</p>
        {hydrated && songs.length > 0 && (
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <CollectionActions songs={songs} />
            <button type="button" onClick={clear} className="button-secondary">
              <Icon name="close" size={15} />
              {source === 'liked' ? 'Remove all' : 'Clear history'}
            </button>
          </div>
        )}
      </section>

      {/* Until the store is read there is nothing truthful to show, and claiming
          the collection is empty would be wrong for most returning listeners. */}
      {!hydrated ? (
        <p className="px-1 text-[13px] text-text-secondary">Loading your {kind.toLowerCase()}…</p>
      ) : songs.length ? (
        <section>
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <p className="section-kicker mb-1">
                {source === 'liked' ? 'Saved on this device' : 'Most recent first'}
              </p>
              <h2 className="section-title">
                {songs.length} {songs.length === 1 ? 'track' : 'tracks'}
              </h2>
            </div>
          </div>
          <div className="premium-panel p-2 sm:p-3">
            <TrackList songs={songs} />
          </div>
        </section>
      ) : (
        <section className="premium-panel mx-auto flex w-full max-w-2xl flex-col items-center p-8 text-center sm:p-12">
          <span className="grid h-16 w-16 place-items-center rounded-full bg-fuchsia-400/10 text-accent-soft ring-1 ring-fuchsia-300/30">
            <Icon name={icon} size={27} />
          </span>
          <h2 className="mt-5 text-h4 font-extrabold">
            {source === 'liked' ? 'No favourites yet' : 'Nothing played yet'}
          </h2>
          <p className="mt-2 max-w-lg text-[14px] leading-relaxed text-text-secondary">
            {source === 'liked'
              ? 'Tap the heart on any track and it will be waiting here.'
              : 'Play something and it will appear here automatically.'}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/explore" className="button-primary">
              <Icon name="sparkle" size={16} />
              Explore music
            </Link>
            <Link href="/search" className="button-secondary">
              <Icon name="search" size={16} />
              Find a track
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
