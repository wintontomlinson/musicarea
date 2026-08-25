import Image from 'next/image';
import type { Song } from '@/lib/types';
import { artistLine, pickImage } from '@/lib/utils';
import { PlayPill } from '@/components/player/PlayPill';

/**
 * The featured card at the top of Listen Now. Apple Music derives a colour wash
 * from the artwork, so the cover is scaled and blurred behind a scrim with the
 * sharp square cover sitting on top of it.
 *
 * The page owns the h1 (the greeting, as Apple does), so this heading is an h2.
 */
export function Hero({ song }: { song: Song }) {
  const cover = pickImage(song.image);
  return (
    <section className="relative overflow-hidden rounded-xl2 border border-subtle">
      <Image
        src={cover}
        alt=""
        fill
        priority
        sizes="100vw"
        className="scale-125 object-cover opacity-45 blur-2xl"
      />
      <div className="absolute inset-0 bg-gradient-to-tr from-black/90 via-black/70 to-black/40" />

      <div className="relative flex flex-col gap-5 p-5 sm:flex-row sm:items-end sm:gap-7 sm:p-8">
        <div className="relative aspect-square w-32 shrink-0 overflow-hidden rounded-card shadow-lift sm:w-44 lg:w-52">
          <Image src={cover} alt={song.name} fill priority sizes="208px" className="object-cover" />
        </div>

        <div className="min-w-0 max-w-2xl">
          <p className="eyebrow">Featured Track</p>
          <h2 className="mt-1.5 line-clamp-2 text-h3 font-bold tracking-tight sm:text-h2">
            {song.name}
          </h2>
          <p className="mt-1.5 truncate text-[15px] text-white/70 sm:text-h5">{artistLine(song)}</p>
          <div className="mt-5">
            <PlayPill song={song} />
          </div>
        </div>
      </div>
    </section>
  );
}
