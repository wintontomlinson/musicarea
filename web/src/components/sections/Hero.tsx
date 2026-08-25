import Image from 'next/image';
import type { Song } from '@/lib/types';
import { artistLine, pickImage } from '@/lib/utils';
import { HeroActions } from './HeroActions';

export function Hero({ song, greeting }: { song: Song; greeting: string }) {
  const cover = pickImage(song.image);
  return (
    <section className="flex items-center gap-4 sm:gap-6">
      <div className="relative h-24 w-24 shrink-0 overflow-hidden sm:h-32 sm:w-32">
        <Image src={cover} alt={song.name} fill priority sizes="128px" className="object-cover" />
      </div>
      <div className="min-w-0">
        <p className="eyebrow">{greeting}</p>
        <h1 className="mt-1 line-clamp-2 text-h3 font-extrabold tracking-tight sm:text-h2">{song.name}</h1>
        <p className="mt-1 truncate text-sm text-text-secondary sm:text-base">{artistLine(song)}</p>
        <HeroActions song={song} />
      </div>
    </section>
  );
}
