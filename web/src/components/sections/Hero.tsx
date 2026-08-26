import Image from 'next/image';
import type { Song } from '@/lib/types';
import { artistLine, pickImage } from '@/lib/utils';
import { PlayPill } from '@/components/player/PlayPill';

export function Hero({ song }: { song: Song }) {
  const cover = pickImage(song.image);
  return (
    <section className="relative overflow-hidden rounded-xl2 border border-white/10 bg-[#16111e]">
      <Image src={cover} alt="" fill priority sizes="100vw" className="object-cover opacity-25" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#16111e] via-[#16111e]/92 to-[#16111e]/50" />
      <div className="relative flex min-h-[272px] flex-col justify-end gap-6 p-5 sm:min-h-[320px] sm:flex-row sm:items-end sm:justify-between sm:gap-8 sm:p-8">
        <div className="min-w-0 max-w-2xl">
          <p className="text-[12px] font-medium text-text-secondary">Featured track</p>
          <h2 className="mt-2 line-clamp-2 text-h2 font-extrabold tracking-[-0.04em] sm:text-[42px] sm:leading-[1.04]">{song.name}</h2>
          <p className="mt-2 truncate text-[16px] text-white/72">{artistLine(song)}</p>
          <div className="mt-6"><PlayPill song={song} /></div>
        </div>
        <div className="relative aspect-square w-28 shrink-0 overflow-hidden rounded-card border border-white/15 shadow-lift sm:w-44 lg:w-52">
          <Image src={cover} alt={song.name} fill priority sizes="208px" className="object-cover" />
        </div>
      </div>
    </section>
  );
}
