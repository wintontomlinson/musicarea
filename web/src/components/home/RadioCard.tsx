'use client';

import { useState } from 'react';
import Image from 'next/image';
import { m } from 'motion/react';
import type { RadioStation, Song } from '@/lib/types';
import { usePlayer } from '@/stores/player';
import { artistLine, pickImage } from '@/lib/utils';
import { Icon } from '@/components/ui/Icon';
import { SPRING_SNAP } from '@/lib/motion';

/**
 * The station card, this app's equivalent of Spotify's AI DJ banner.
 *
 * Unlike that banner, this one is real. The Flask layer already exposes
 * `/api/radio/<song_id>`, an endless station built by the recommender from a seed
 * track, and nothing in the app had ever called it. The card seeds from the last thing
 * the listener played, so the offer is specific ("a station from Kesariya") rather than
 * a generic promise.
 *
 * The station is fetched on tap, not on mount. Building one is real work upstream, and
 * doing it on every home page view for a card most listeners scroll past would be a
 * request per visit for nothing. Everything shown before the tap comes from the seed
 * track, which is already in hand.
 */
export function RadioCard({ seed }: { seed: Song }) {
  const playQueue = usePlayer((state) => state.playQueue);
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle');

  async function start() {
    if (state === 'loading') return;
    setState('loading');
    try {
      const res = await fetch(`/api/radio/${encodeURIComponent(seed.id)}`);
      if (!res.ok) throw new Error('station unavailable');
      const station = (await res.json()) as RadioStation;
      if (!station.items?.length) throw new Error('empty station');
      // The seed goes in front of its own station. The endpoint excludes it from the
      // results (a station should not open with the track it was built from), but
      // starting on the familiar song is what makes the transition into unfamiliar
      // material feel deliberate rather than abrupt.
      playQueue([seed, ...station.items], 0);
      setState('idle');
    } catch {
      setState('error');
    }
  }

  const cover = pickImage(seed.image);

  return (
    <section aria-labelledby="radio-card">
      <div className="relative overflow-hidden rounded-xl2 border border-white/12 shadow-lift">
        {/* The seed's own artwork, blurred, as the backdrop. The palette engine has
            already tinted the whole page from this same image, so the card sits inside
            the page's colour rather than introducing another one. */}
        <Image
          src={cover}
          alt=""
          fill
          sizes="(max-width: 1024px) 100vw, 1100px"
          className="scale-125 object-cover opacity-40 blur-2xl"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(circle_at_12%_20%,rgb(var(--accent-rgb)/.42),transparent_46%),radial-gradient(circle_at_88%_10%,rgb(var(--accent-alt-rgb)/.3),transparent_44%),linear-gradient(115deg,rgb(var(--scrim-rgb)/.82),rgb(var(--scrim-rgb)/.55))]"
        />

        <div className="relative flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:gap-6 sm:p-6">
          <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-card-lg border border-white/20 shadow-glow sm:h-28 sm:w-28">
            <Image src={cover} alt="" fill sizes="112px" className="object-cover" />
          </div>

          <div className="min-w-0 flex-1">
            <p className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.15em] text-accent-soft">
              <Icon name="radio" size={14} />
              Radio
            </p>
            <h2 id="radio-card" className="mt-1.5 font-display text-h3 font-extrabold tracking-[-0.03em]">
              Your station is ready
            </h2>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-white/75">
              An endless mix built out from{' '}
              <span className="font-bold text-white">{seed.name}</span> by {artistLine(seed)}, and
              the artists that sit alongside it.
            </p>
            {state === 'error' && (
              <p role="alert" className="mt-2 text-[12.5px] font-semibold text-amber-300">
                That station could not be built. Try another track.
              </p>
            )}
          </div>

          <m.button
            type="button"
            onClick={start}
            disabled={state === 'loading'}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            transition={SPRING_SNAP}
            className="button-primary shrink-0 self-start px-6 py-3 text-[15px] sm:self-auto"
          >
            {state === 'loading' ? (
              <>
                <span
                  className="h-4 w-4 animate-spin rounded-full border-2 border-on-accent/30 border-t-on-accent"
                  aria-hidden="true"
                />
                Building
              </>
            ) : (
              <>
                <Icon name="play" size={16} />
                Start station
              </>
            )}
          </m.button>
        </div>
      </div>
    </section>
  );
}
