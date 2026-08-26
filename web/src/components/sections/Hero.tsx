import Image from 'next/image';
import type { Song } from '@/lib/types';
import { artistLine, pickImage } from '@/lib/utils';
import { PlayPill } from '@/components/player/PlayPill';
import { Icon } from '@/components/ui/Icon';

export function Hero({ song }: { song: Song }) {
  const cover = pickImage(song.image);
  return (
    <section className="disco-panel min-h-[300px] sm:min-h-[360px]">
      <Image src={cover} alt="" fill priority sizes="100vw" className="scale-110 object-cover opacity-35 blur-2xl" />
      <div className="absolute inset-0 bg-gradient-to-r from-surface-raised/95 via-surface-raised/80 to-surface/35" />
      <div className="absolute -right-14 -top-20 h-64 w-64 rounded-full border border-accent-alt/30 bg-accent-alt/10 blur-[1px]" />
      <div className="absolute -right-6 top-9 grid h-36 w-36 place-items-center rounded-full border-[18px] border-accent-soft/20 bg-black/20 shadow-glow"><span className="h-8 w-8 rounded-full bg-accent-soft/80" /></div>
      <div className="relative flex h-full flex-col justify-end gap-6 p-5 sm:flex-row sm:items-end sm:justify-between sm:gap-8 sm:p-8 lg:p-10">
        <div className="min-w-0 max-w-2xl">
          <div className="mb-3 flex items-center gap-2"><span className="neon-dot" /><p className="section-kicker">In rotation now</p></div>
          <h2 className="line-clamp-2 text-h2 font-extrabold tracking-[-0.04em] sm:text-[46px] sm:leading-[1.02]">{song.name}</h2>
          <p className="mt-2 truncate text-[16px] font-medium text-white/75 sm:text-[18px]">{artistLine(song)}</p>
          <div className="mt-6 flex flex-wrap items-center gap-3"><PlayPill song={song} /><span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-white/65"><Icon name="sparkle" size={14} className="text-accent-alt" />Fresh from the catalogue</span></div>
        </div>
        <div className="relative aspect-square w-32 shrink-0 overflow-hidden rounded-xl2 border border-white/20 shadow-[0_24px_55px_-20px_rgba(0,0,0,1)] sm:w-48 lg:w-56"><Image src={cover} alt={song.name} fill priority sizes="224px" className="object-cover" /></div>
      </div>
    </section>
  );
}
