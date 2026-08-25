import Link from 'next/link';
import Image from 'next/image';
import type { Mood } from '@/lib/types';

export function MoodGrid({ moods, heading = 'Moods & Genres' }: { moods: Mood[]; heading?: string }) {
  if (!moods?.length) return null;
  return (
    <section>
      <h2 className="mb-3 section-title">{heading}</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {moods.map((mood) => (
          <Link key={mood.id} href={`/mood/${mood.id}`} className="group relative flex aspect-[7/4] items-end overflow-hidden rounded-card bg-surface-raised p-4 shadow-lift">
            {mood.image && <Image src={mood.image} alt="" fill sizes="(max-width: 640px) 45vw, 220px" className="object-cover opacity-50 transition-transform duration-300 group-hover:scale-105" />}
            <span className="absolute inset-0 bg-gradient-to-br from-transparent to-black/80" />
            <span className="relative text-h5 font-extrabold drop-shadow">{mood.name}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
