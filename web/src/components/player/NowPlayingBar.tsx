'use client';

import Image from 'next/image';
import { usePlayer } from '@/stores/player';
import { artistLine, pickImage } from '@/lib/utils';
import { SeekBar } from './SeekBar';

/**
 * Apple Music's toolbar "LCD": the compact now-playing display that sits in the
 * centre of the top bar on desktop, showing artwork, title, artist and a seek
 * bar. The artwork is the single control that opens the full-screen player.
 * Rendered as a placeholder plate when nothing is queued, so the toolbar keeps
 * its shape.
 */
export function NowPlayingBar() {
  const track = usePlayer((state) => state.currentTrack());
  const setFullscreen = usePlayer((state) => state.setFullscreen);

  if (!track) {
    return (
      <div className="hidden h-14 flex-1 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] lg:flex">
        <span className="inline-flex items-center gap-2 text-[12px] font-semibold text-text-muted"><span className="h-1.5 w-1.5 rounded-full bg-accent" />Choose a track to begin</span>
      </div>
    );
  }

  const cover = pickImage(track.image, '150x150');

  return (
    <div className="hidden h-14 flex-1 items-center gap-3 rounded-xl border border-accent/15 bg-accent/[0.05] px-2 lg:flex">
      <button
        type="button"
        onClick={() => setFullscreen(true)}
        aria-label="Open full screen player"
        className="relative h-10 w-10 shrink-0 overflow-hidden rounded"
      >
        <Image src={cover} alt="" fill sizes="40px" className="object-cover" />
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <p className="truncate text-[13px] font-semibold leading-tight">{track.name}</p>
          <p className="truncate text-[12px] leading-tight text-text-secondary">
            {artistLine(track)}
          </p>
        </div>
        <div className="mt-1">
          <SeekBar showTimes />
        </div>
      </div>
    </div>
  );
}
