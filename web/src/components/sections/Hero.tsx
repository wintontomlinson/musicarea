import Image from 'next/image';
import type { Song } from '@/lib/types';
import { Icon } from '@/components/ui/Icon';
import { artistLine, pickImage } from '@/lib/utils';

/**
 * Full-width featured banner. The dynamic color wash is derived from the track
 * hue on the server (a static gradient here; live dominant-color extraction is
 * a client concern handled in a later phase). Text and CTAs sit over a dark
 * scrim so the artwork never fights the copy.
 */
export function Hero({ song, greeting }: { song: Song; greeting: string }) {
  const cover = pickImage(song.image);
  return (
    <section className="relative overflow-hidden rounded-xl2 border border-subtle noise">
      <Image
        src={cover}
        alt=""
        fill
        priority
        sizes="100vw"
        className="scale-110 object-cover opacity-40 blur-2xl"
      />
      <div className="absolute inset-0 bg-gradient-to-tr from-bg via-bg/80 to-transparent" />

      <div className="relative flex flex-col gap-6 p-6 sm:p-10 lg:flex-row lg:items-end">
        <div className="relative aspect-square w-40 shrink-0 overflow-hidden rounded-card shadow-lift sm:w-52 lg:w-60">
          <Image
            src={cover}
            alt={song.name}
            fill
            priority
            sizes="240px"
            className="object-cover"
          />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">
            {greeting} · Featured Today
          </p>
          <h1 className="mt-2 line-clamp-2 text-h2 font-extrabold tracking-tight sm:text-h1">
            {song.name}
          </h1>
          <p className="mt-2 text-h5 text-text-secondary">{artistLine(song)}</p>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              className="flex items-center gap-2 rounded-full bg-brand px-6 py-3 text-sm font-bold text-white shadow-glow transition-transform duration-150 hover:scale-[1.03]"
            >
              <Icon name="play" size={18} />
              Play Now
            </button>
            <button
              type="button"
              className="flex items-center gap-2 rounded-full border border-subtle bg-white/5 px-6 py-3 text-sm font-bold text-white transition-colors duration-150 hover:bg-white/10"
            >
              <Icon name="plus" size={18} />
              Add to Library
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
