import Link from 'next/link';
import type { Mood } from '@/lib/types';

export function MoodGrid({ moods, heading = 'Moods & Genres' }: { moods: Mood[]; heading?: string }) {
  if (!moods?.length) return null;
  return (
    <section>
      <h2 className="mb-3 section-title">{heading}</h2>
      <div className="grid grid-cols-2 gap-x-5 gap-y-3 sm:grid-cols-3 lg:grid-cols-4">
        {moods.map((mood) => (
          <Link
            key={mood.id}
            href={`/mood/${mood.id}`}
            className="border-b border-subtle py-3 text-sm font-semibold text-text-secondary transition-colors hover:text-white"
          >
            {mood.name}
          </Link>
        ))}
      </div>
    </section>
  );
}
