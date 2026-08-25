import Link from 'next/link';
import Image from 'next/image';
import type { Mood } from '@/lib/types';

/**
 * Mood and genre tiles. Artwork with a flat black scrim so the label stays
 * readable; no coloured tinting.
 */
export function MoodGrid({ moods, heading = 'Moods & Genres' }: { moods: Mood[]; heading?: string }) {
  if (!moods?.length) return null;
  return (
    <section>
      <h2 className="mb-3 section-title">{heading}</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {moods.map((mood) => (
          <Link
            key={mood.id}
            href={`/mood/${mood.id}`}
            className="group relative flex aspect-[7/4] items-end overflow-hidden rounded-card border border-subtle bg-surface p-4"
          >
            {mood.image && (
              <>
                <Image
                  src={mood.image}
                  alt=""
                  fill
                  sizes="(max-width: 640px) 45vw, 220px"
                  className="object-cover opacity-45 transition-opacity duration-150 group-hover:opacity-60"
                />
                {/* Scrim only when there is artwork, so a missing image leaves a
                    clean surface rather than an extra dark layer. */}
                <span aria-hidden="true" className="absolute inset-0 bg-black/45" />
              </>
            )}
            <span className="relative text-h5 font-bold">{mood.name}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
