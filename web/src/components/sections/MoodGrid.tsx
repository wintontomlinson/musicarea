import Link from 'next/link';
import Image from 'next/image';
import type { Mood } from '@/lib/types';

/**
 * Apple Music's Browse tiles: wide rounded artwork with the name set over a
 * bottom-weighted scrim.
 */
export function MoodGrid({ moods, heading = 'Browse by Category' }: { moods: Mood[]; heading?: string }) {
  if (!moods?.length) return null;
  return (
    <section>
      <h2 className="mb-3 section-title">{heading}</h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {moods.map((mood) => (
          <Link
            key={mood.id}
            href={`/mood/${mood.id}`}
            className="group relative flex aspect-[16/9] items-end overflow-hidden rounded-card border border-subtle bg-surface p-3 shadow-lift"
          >
            {mood.image && (
              <>
                <Image
                  src={mood.image}
                  alt=""
                  fill
                  sizes="(max-width: 640px) 45vw, 260px"
                  className="object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                />
                {/* Scrim only when there is artwork, so a missing image leaves a
                    clean surface rather than an extra dark layer. */}
                <span
                  aria-hidden="true"
                  className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent"
                />
              </>
            )}
            <span className="relative text-[15px] font-semibold">{mood.name}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
