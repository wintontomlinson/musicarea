'use client';

import Image from 'next/image';
import type { Mix } from '@/lib/types';
import { usePlayer } from '@/stores/player';
import { FALLBACK_COVER, pickImage } from '@/lib/utils';
import { Icon } from '@/components/ui/Icon';

/**
 * A generated mix, as a four-cover collage.
 *
 * A mix has no page of its own to link to: it is assembled per request from the
 * listening profile and would be rebuilt differently on the next visit, so the
 * tile plays it directly instead of navigating.
 *
 * The collage borrows art from the mix's own first four tracks. Editorial cover
 * art has titles typeset into it, so a single full-size cover would compete with
 * the mix name; four quarter-size ones read as colour and texture instead.
 */
export function MixCard({ mix }: { mix: Mix }) {
  const playQueue = usePlayer((s) => s.playQueue);
  const covers = (mix.covers ?? []).slice(0, 4).map((c) => pickImage(c ?? undefined, '150x150'));
  while (covers.length < 4) covers.push(covers[0] ?? FALLBACK_COVER);

  const count = mix.songCount ?? mix.items.length;

  return (
    <button
      type="button"
      onClick={() => playQueue(mix.items, 0)}
      disabled={!mix.items.length}
      title={mix.note}
      className="group block w-full text-left disabled:opacity-50"
    >
      <div className="relative aspect-square overflow-hidden rounded-card border border-white/10 shadow-lift transition duration-300 group-hover:-translate-y-1 group-hover:border-fuchsia-200/45 group-hover:shadow-glow">
        <div className="grid h-full w-full grid-cols-2 grid-rows-2">
          {covers.map((src, i) => (
            <span key={i} className="relative block overflow-hidden">
              <Image src={src} alt="" fill sizes="100px" className="object-cover" />
            </span>
          ))}
        </div>
        {/* A wash over the collage so the mix name stays legible on any artwork. */}
        <span
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-[#0b0614]/92 via-[#0b0614]/45 to-transparent"
        />
        <span className="absolute inset-x-0 bottom-0 p-3">
          <span className="block truncate text-[14px] font-extrabold leading-tight text-white">
            {mix.name}
          </span>
          <span className="mt-0.5 block truncate text-[11px] text-white/70">
            {count} {count === 1 ? 'track' : 'tracks'}
          </span>
        </span>
        <span
          aria-hidden="true"
          className="absolute right-2.5 top-2.5 grid h-9 w-9 translate-y-1 place-items-center rounded-full bg-brand text-white opacity-0 shadow-glow transition duration-300 group-hover:translate-y-0 group-hover:opacity-100"
        >
          <Icon name="play" size={14} />
        </span>
      </div>
      {mix.subtitle && (
        <p className="mt-2 truncate text-[12px] leading-tight text-text-secondary">{mix.subtitle}</p>
      )}
    </button>
  );
}
