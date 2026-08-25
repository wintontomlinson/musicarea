import Image from 'next/image';
import type { Song } from '@/lib/types';
import { artistLine, pickImage } from '@/lib/utils';
import { HeroActions } from './HeroActions';

export function Hero({ song, greeting }: { song: Song; greeting: string }) {
  const cover = pickImage(song.image);
  return (
    <section className="premium-panel relative min-h-[320px] overflow-hidden sm:min-h-[380px]">
      <Image src={cover} alt="" fill priority sizes="100vw" className="scale-110 object-cover opacity-40 blur-2xl" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#120c10] via-bg/85 to-bg/35" />
      <div className="relative flex h-full min-h-[320px] items-end gap-6 p-6 sm:min-h-[380px] sm:p-9 lg:p-10">
        <div className="relative hidden aspect-square w-44 shrink-0 overflow-hidden rounded-card shadow-lift sm:block lg:w-56">
          <Image src={cover} alt={song.name} fill priority sizes="224px" className="object-cover" />
        </div>
        <div className="max-w-2xl pb-1">
          <p className="eyebrow">{greeting} · Your featured track</p>
          <h1 className="mt-2 line-clamp-2 text-h2 font-extrabold tracking-tight sm:text-h1">{song.name}</h1>
          <p className="mt-2 text-base text-white/70 sm:text-h5">{artistLine(song)}</p>
          <HeroActions song={song} />
        </div>
      </div>
    </section>
  );
}
