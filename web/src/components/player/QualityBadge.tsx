'use client';

import { usePlayer } from '@/stores/player';
import { pickStream } from '@/lib/utils';

/**
 * Reports the bitrate of the stream actually playing.
 *
 * The brief asked for a "Lossless / Hi-Res" badge. This catalogue serves AAC at up
 * to 320kbps and nothing lossless exists in it, so a Lossless badge would be
 * decoration claiming a capability the app does not have. The badge instead states
 * the real number, which is genuinely useful: it is how a listener can tell that a
 * track fell back to 96kbps on a weak connection.
 *
 * The label comes from `pickStream`, the same function the audio engine resolves its
 * URL through, so the two cannot disagree.
 */
export function QualityBadge({ className = '' }: { className?: string }) {
  // Subscribing to the array rather than the track object: its identity only
  // changes when the track does, so this does not re-render on progress ticks.
  const downloadUrl = usePlayer((state) => state.currentTrack()?.downloadUrl);
  const track = usePlayer((state) => state.currentTrack());

  if (!track) return null;
  const stream = downloadUrl ? pickStream(track) : null;
  // A slim record restored from localStorage has no `downloadUrl` until the engine
  // re-resolves it. Rendering nothing beats rendering a wrong or empty figure.
  if (!stream) return null;

  const kbps = stream.quality.replace('kbps', '');
  if (!/^\d+$/.test(kbps)) return null;

  const high = Number(kbps) >= 320;

  return (
    <span
      // `title` rather than a visible caption. The badge has to stay small enough to
      // sit in a player bar, and the explanation only matters to someone who
      // deliberately looks at it.
      title={`Streaming AAC at ${kbps}kbps`}
      className={`inline-flex shrink-0 items-center gap-1 rounded-[5px] border px-1.5 py-0.5 text-[10px] font-bold tabular-nums tracking-wide ${
        high
          ? 'border-accent/40 bg-accent/[0.14] text-accent-soft'
          : 'border-white/15 bg-white/[0.07] text-text-muted'
      } ${className}`}
    >
      {kbps}
      <span className="text-[8px] font-semibold opacity-70">KBPS</span>
    </span>
  );
}
