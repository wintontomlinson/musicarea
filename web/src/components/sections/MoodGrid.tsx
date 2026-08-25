import Link from 'next/link';
import Image from 'next/image';
import type { Mood } from '@/lib/types';

/**
 * Colorful mood/genre tiles. Each tile is tinted in the mood's own hue and, when
 * the catalogue provided cover art, layers a softened collage beneath the label
 * so the tile reads as a mood rather than a single album.
 */
export function MoodGrid({ moods, heading = 'Moods & Genres' }: { moods: Mood[]; heading?: string }) {
  if (!moods?.length) return null;
  return (
    <section className="animate-fade-up">
      <h2 className="mb-3 text-h4 font-extrabold tracking-tight">{heading}</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {moods.map((mood) => (
          <Link
            key={mood.id}
            href={`/mood/${mood.id}`}
            className="group relative flex aspect-[7/5] items-end overflow-hidden rounded-card p-4"
            style={{ background: `hsl(${mood.hue} 55% 24%)` }}
          >
            {mood.image && (
              <Image
                src={mood.image}
                alt=""
                fill
                sizes="(max-width: 640px) 45vw, 220px"
                className="object-cover opacity-40 blur-[2px] transition-transform duration-300 group-hover:scale-105"
              />
            )}
            <span
              className="absolute inset-0"
              style={{
                background: `linear-gradient(150deg, hsl(${mood.hue} 80% 44% / 0.55), hsl(${mood.hue + 40} 70% 16% / 0.85))`,
              }}
            />
            <span className="relative text-h5 font-extrabold drop-shadow">{mood.name}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
