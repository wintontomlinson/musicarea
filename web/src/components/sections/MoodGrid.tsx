import Link from 'next/link';
import Image from 'next/image';
import type { Mood } from '@/lib/types';
import { Icon } from '@/components/ui/Icon';

export function MoodGrid({ moods, heading = 'Browse by Category' }: { moods: Mood[]; heading?: string }) {
  if (!moods?.length) return null;
  return <section><div className="mb-4 flex items-end justify-between gap-3"><div><p className="section-kicker mb-1">Choose your energy</p><h2 className="section-title">{heading}</h2></div><Icon name="sparkle" size={19} className="text-accent-alt" /></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{moods.map((mood) => <Link key={mood.id} href={`/mood/${mood.id}`} className="group relative flex aspect-[15/10] items-end overflow-hidden rounded-card border border-white/15 bg-surface p-3 shadow-lift transition duration-300 hover:-translate-y-1 hover:border-accent-soft/50 hover:shadow-glow">{mood.image && <><Image src={mood.image} alt="" fill sizes="(max-width: 640px) 45vw, 260px" className="object-cover transition duration-500 group-hover:scale-110" /><span aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-scrim/95 via-surface-raised/25 to-accent-alt/10" /></>}<span className="relative text-[15px] font-extrabold tracking-tight">{mood.name}</span><Icon name="chevronRight" size={17} className="absolute bottom-3 right-3 text-white/0 transition group-hover:text-accent-alt" /></Link>)}</div></section>;
}
