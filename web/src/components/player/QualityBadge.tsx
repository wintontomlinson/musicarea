'use client';

import { usePlayer } from '@/stores/player';

/**
 * Reports the bitrate rung **in use**, not the one requested.
 *
 * That distinction is the whole point of showing it. Not every track publishes
 * every rung, so a listener who asked for 320 can be hearing 96 with nothing to
 * tell them; the badge turns amber when this particular track forced a step down,
 * so the setting cannot quietly overstate what is being delivered.
 *
 * Nothing is shown until a stream is loaded, since there would be no truth to
 * report yet.
 */
export function QualityBadge() {
  const activeQuality = usePlayer((s) => s.activeQuality);
  const steppedDown = usePlayer((s) => s.activeSteppedDown);
  const requested = usePlayer((s) => s.quality);

  if (!activeQuality) return null;

  // "320kbps" reads as clutter in a toolbar; the number carries it.
  const shown = activeQuality.replace(/kbps$/i, '');

  return (
    <span
      title={
        steppedDown
          ? `This track does not offer ${requested}, so it is playing at ${activeQuality}`
          : `Playing at ${activeQuality}`
      }
      className={`rounded px-1.5 py-0.5 text-[10px] font-bold tabular-nums transition-colors ${
        steppedDown
          ? 'bg-amber-400/15 text-amber-200'
          : 'bg-white/[0.08] text-text-secondary'
      }`}
    >
      {shown}
    </span>
  );
}
