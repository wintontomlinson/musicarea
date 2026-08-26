import Link from 'next/link';
import Image from 'next/image';
import type { Mood } from '@/lib/types';

export function MoodGrid({ moods, heading = 'Browse by Category' }: { moods: Mood[]; heading?: string }) {
  if (!moods?.length) return null;
  return (
    <section>
      <h2 className="mb-4 section-title">{heading}</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {moods.map((mood) => (
          <Link key={mood.id} href={`/mood/${mood.id}`} className="group relative flex aspect-[15/10] items-end overflow-hidden rounded-card border border-white/10 bg-surface p-3 transition-colors hover:border-white/25">
            {mood.image && <><Image src={mood.image} alt="" fill sizes="(max-width: 640px) 45vw, 260px" className="object-cover transition-transform duration-300 group-hover:scale-[1.03]" /><span aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-[#100c17]/90 via-[#100c17]/20 to-transparent" /></>}
            <span className="relative text-[15px] font-bold tracking-tight">{mood.name}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
