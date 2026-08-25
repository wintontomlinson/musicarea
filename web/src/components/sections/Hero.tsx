import Image from 'next/image';
import type { Song } from '@/lib/types';
import { artistLine, pickImage } from '@/lib/utils';
import { HeroActions } from './HeroActions';

export function Hero({ song, greeting }: { song: Song; greeting: string }) {
  const cover = pickImage(song.image);
  return (
    <section className="surface-card relative overflow-hidden bg-surface-raised">
      <Image
        src={cover}
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover opacity-20"
      />
      <div className="absolute inset-0 bg-black/60" />

      <div className="relative flex min-h-[260px] items-end gap-5 p-5 sm:min-h-[320px] sm:p-8 lg:p-10">
        <div className="relative hidden aspect-square w-44 shrink-0 overflow-hidden rounded-card shadow-lift sm:block lg:w-52">
          <Image src={cover} alt={song.name} fill priority sizes="208px" className="object-cover" />
        </div>
        <div className="min-w-0 max-w-2xl">
          <p className="eyebrow">{greeting} · Featured</p>
          <h1 className="mt-2 line-clamp-2 text-h2 font-extrabold tracking-tight sm:text-h1">{song.name}</h1>
          <p className="mt-2 truncate text-base text-white/65 sm:text-h5">{artistLine(song)}</p>
          <HeroActions song={song} />
        </div>
      </div>
    </section>
  );
}
