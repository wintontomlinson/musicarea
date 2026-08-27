'use client';

import Link from 'next/link';
import type { Mood } from '@/lib/types';
import { Chip } from '@/components/ui/Chip';
import { Icon } from '@/components/ui/Icon';

interface MoodChipsProps {
  moods: Mood[];
  /** Currently applied mood id, or null for the unfiltered feed. */
  active: string | null;
  onChange: (moodId: string | null) => void;
}

/**
 * Horizontal mood filter row, in YouTube Music's style.
 *
 * These are buttons rather than links, because selecting one re-ranks the feed on this
 * page instead of navigating. Each mood does also have a page of its own, reachable
 * from the arrow at the end of the row once a mood is applied, so the deep link is not
 * lost.
 *
 * The tint comes from `Mood.hue`, which the catalogue has always carried and nothing
 * has ever used. Colouring each chip by its own hue turns the row into a palette of
 * moods, where accent-coloured chips would have made six different feelings look
 * identical.
 */
export function MoodChips({ moods, active, onChange }: MoodChipsProps) {
  if (!moods.length) return null;

  return (
    <section aria-label="Filter by mood">
      {/* Negative margins let the row bleed to the screen edge while its content stays
          aligned with the page gutter, so a scrolled chip is cut off by the viewport
          rather than appearing to stop short of it. */}
      <div className="no-scrollbar -mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 sm:-mx-8 sm:px-8 lg:-mx-10 lg:px-10">
        <Chip
          onClick={() => onChange(null)}
          active={active === null}
          pressed={active === null}
          icon="sparkle"
        >
          For you
        </Chip>

        {moods.map((mood) => {
          const isActive = active === mood.id;
          return (
            <Chip
              key={mood.id}
              onClick={() => onChange(isActive ? null : mood.id)}
              active={isActive}
              pressed={isActive}
              // Only applied when active. A tinted background on every chip would
              // compete with the artwork below and make the row the loudest thing on
              // the page.
              activeStyle={
                typeof mood.hue === 'number'
                  ? {
                      backgroundImage: 'none',
                      backgroundColor: `hsl(${mood.hue} 72% 46%)`,
                      color: '#fff',
                      boxShadow: `0 12px 30px -12px hsl(${mood.hue} 72% 46% / 0.6)`,
                    }
                  : undefined
              }
            >
              {mood.name}
            </Chip>
          );
        })}

        {active && (
          <Link
            href={`/mood/${active}`}
            className="chip shrink-0 gap-1 text-accent-soft"
            aria-label="Open this mood in full"
          >
            Open
            <Icon name="chevronRight" size={13} />
          </Link>
        )}
      </div>
    </section>
  );
}
