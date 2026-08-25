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
      <div className="glass-panel hidden h-14 flex-1 items-center justify-center rounded-lg lg:flex">
        <span className="text-[13px] text-text-muted">Not playing</span>
      </div>
    );
  }

  const cover = pickImage(track.image, '150x150');

  return (
    <div className="glass-panel hidden h-14 flex-1 items-center gap-3 rounded-lg px-2 lg:flex">
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
