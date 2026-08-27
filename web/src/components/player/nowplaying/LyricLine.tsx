'use client';

import { m } from 'motion/react';
import { EASE_SMOOTH } from '@/lib/motion';
import { Icon } from '@/components/ui/Icon';

interface LyricLineProps {
  text: string;
  /**
   * How far from the active line this one sits, and the input the whole visual treatment is
   * derived from. 0 is the line being sung, negative is already past, positive is upcoming.
   */
  distance: number;
  /** Untimed lyrics render as a flat reading view with no active line at all. */
  flat: boolean;
  onSeek?: () => void;
}

/**
 * One line of lyrics.
 *
 * The Apple Music treatment, which is mostly about *falloff* rather than about the active
 * line itself. The current line is full white and full size; each line either side steps down
 * in opacity and scale, so the eye is pulled to one place without the surrounding lines
 * disappearing. Showing only the active line loses the context that makes it possible to
 * sing along, and showing every line equally gives the eye nothing to lock onto.
 *
 * Past and upcoming lines are treated differently: upcoming lines stay more legible than ones
 * already sung, because they are the ones about to be needed.
 */
export function LyricLine({ text, distance, flat, onSeek }: LyricLineProps) {
  const active = !flat && distance === 0;
  const ahead = distance > 0;
  const steps = Math.min(Math.abs(distance), 4);

  // Lines already sung fade faster than lines coming up.
  const opacity = flat ? 0.82 : active ? 1 : Math.max(ahead ? 0.5 - steps * 0.09 : 0.32 - steps * 0.07, 0.06);

  // A blank line between cues is an instrumental gap. Rendering nothing would collapse the
  // spacing and make the gap look like a rendering fault, so it gets a mark instead.
  if (!text) {
    return (
      <div className="flex justify-center py-3" aria-hidden="true">
        <m.span
          animate={{ opacity: active ? 0.9 : 0.25, scale: active ? 1 : 0.9 }}
          transition={{ duration: 0.3, ease: EASE_SMOOTH }}
          className="text-accent-soft"
        >
          <Icon name="disc" size={active ? 22 : 16} />
        </m.span>
      </div>
    );
  }

  const content = (
    <m.span
      // Animating opacity and scale rather than switching classes, so a line that becomes
      // active eases into focus instead of snapping. `filter` is left alone deliberately: a
      // blur transition on twenty lines of text at once is expensive enough to drop frames on
      // a mid-range phone.
      animate={{ opacity, scale: active ? 1 : 0.965 }}
      transition={{ duration: 0.34, ease: EASE_SMOOTH }}
      className={`block origin-center font-display font-extrabold tracking-[-0.02em] ${
        flat ? 'text-lyric' : active ? 'text-lyric lg:text-lyric-lg' : 'text-lyric'
      } ${active ? 'text-white' : 'text-white/90'}`}
    >
      {text}
    </m.span>
  );

  // Timed lines are seekable: tapping a line jumps to the moment it is sung, which is the
  // fastest way back to a chorus. Untimed lines have no position to jump to, so they stay
  // plain text rather than pretending to be interactive.
  if (flat || !onSeek) {
    return <div className="py-2.5 text-center">{content}</div>;
  }

  return (
    <button
      type="button"
      onClick={onSeek}
      className="block w-full rounded-card px-2 py-2.5 text-center transition-colors hover:bg-white/[0.06]"
    >
      {content}
    </button>
  );
}
