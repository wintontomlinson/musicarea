import type { Song } from '@/lib/types';
import { Icon } from '@/components/ui/Icon';

/**
 * Shows why a track was recommended.
 *
 * `Song.recommendation` has always been returned by the feed endpoint, carrying a
 * `reason` string, a score, and `discovery` / `familiar` flags. Nothing in the app
 * rendered any of it, which meant the recommender was doing the work of explaining
 * itself and the UI was throwing the answer away.
 *
 * Surfacing the reason is what separates a personalised row from a random one. A row
 * of unfamiliar covers is indistinguishable from noise; the same row with "because you
 * played Kesariya" attached is legible.
 *
 * Renders nothing when there is no reason, rather than inventing one. Editorial rows
 * carry no recommendation at all, and a fabricated explanation on those would make the
 * genuine ones untrustworthy.
 */
export function ReasonPill({ song, className = '' }: { song: Song; className?: string }) {
  const recommendation = song.recommendation;
  const reason = recommendation?.reason?.trim();
  if (!reason) return null;

  const discovery = recommendation?.discovery === true;

  return (
    <span
      className={`inline-flex max-w-full items-center gap-1.5 rounded-pill border px-2 py-0.5 text-[10.5px] font-bold ${
        discovery
          ? 'border-accent-alt/30 bg-accent-alt/[0.12] text-accent-alt'
          : 'border-accent/25 bg-accent/[0.1] text-accent-soft'
      } ${className}`}
    >
      {/* Discovery and familiarity are different promises, so they get different
          glyphs: a spark for something new, a heart for something the profile already
          leans toward. */}
      <Icon name={discovery ? 'sparkle' : 'heart'} size={11} className="shrink-0" />
      <span className="truncate">{reason}</span>
    </span>
  );
}
