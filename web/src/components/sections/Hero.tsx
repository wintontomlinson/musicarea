import Image from 'next/image';
import type { Song } from '@/lib/types';
import { artistLine, pickImage } from '@/lib/utils';
import { HeroActions } from './HeroActions';

/**
 * Featured track banner. A flat neutral surface with the artwork beside the
 * copy, so the only colour on screen comes from the cover itself.
 */
export function Hero({ song, greeting }: { song: Song; greeting: string }) {
  const cover = pickImage(song.image);
  return (
    <section className="surface-card flex items-end gap-5 p-5 sm:gap-6 sm:p-7">
      <div className="relative aspect-square w-28 shrink-0 overflow-hidden rounded-card sm:w-40 lg:w-48">
        <Image src={cover} alt={song.name} fill priority sizes="192px" className="object-cover" />
      </div>
      <div className="min-w-0 max-w-2xl">
        <p className="eyebrow">{greeting}</p>
        <h1 className="mt-2 line-clamp-2 text-h3 font-extrabold tracking-tight sm:text-h2">
          {song.name}
        </h1>
        <p className="mt-1.5 truncate text-sm text-text-secondary sm:text-base">
          {artistLine(song)}
        </p>
        <HeroActions song={song} />
      </div>
    </section>
  );
}
