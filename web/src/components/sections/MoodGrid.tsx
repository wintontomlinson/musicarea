import Link from 'next/link';
import Image from 'next/image';
import type { Mood } from '@/lib/types';

/**
 * Category tiles. Wide artwork with the name set over a bottom-weighted scrim,
 * which keeps the label legible on any cover without adding a card container.
 */
export function MoodGrid({
  moods,
  heading = 'Browse by mood',
  headingId = 'mood-grid',
}: {
  moods: Mood[];
  heading?: string;
  headingId?: string;
}) {
  if (!moods?.length) return null;

  return (
    <section aria-labelledby={headingId}>
      <h2 id={headingId} className="mb-4 text-section">
        {heading}
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {moods.map((mood) => (
          <Link
            key={mood.id}
            href={`/mood/${mood.id}`}
            className="group relative flex aspect-[16/10] items-end overflow-hidden rounded border border-subtle bg-surface p-3 transition-colors duration-fast hover:border-strong"
          >
            {mood.image && (
              <>
                <Image
                  src={mood.image}
                  alt=""
                  fill
                  sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 240px"
                  className="object-cover transition-transform duration-base ease-out group-hover:scale-[1.04]"
                />
                <span
                  aria-hidden="true"
                  className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent"
                />
              </>
            )}
            <span className="relative text-body font-semibold">{mood.name}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
