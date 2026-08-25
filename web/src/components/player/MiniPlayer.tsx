'use client';

import Image from 'next/image';
import { usePlayer } from '@/stores/player';
import { artistLine, pickImage } from '@/lib/utils';
import { Icon } from '@/components/ui/Icon';
import { TransportControls } from './PlayerControls';
import { SeekBar } from './SeekBar';
import { VolumeControl } from './VolumeControl';

/**
 * Persistent bottom bar. Sits above the mobile tab bar on phones and spans the
 * full width on desktop. Tapping the artwork/title opens the full-screen player.
 * Hidden entirely until something is queued.
 */
export function MiniPlayer() {
  const track = usePlayer((s) => s.currentTrack());
  const setFullscreen = usePlayer((s) => s.setFullscreen);
  const setQueueOpen = usePlayer((s) => s.setQueueOpen);
  const queueOpen = usePlayer((s) => s.queueOpen);

  if (!track) return null;
  const cover = pickImage(track.image, '150x150');

  return (
    <div className="fixed inset-x-0 bottom-16 z-40 lg:bottom-0">
      {/* Full-width progress line sits on top of the bar. */}
      <div className="border-t border-subtle bg-surface/95 backdrop-blur-glass">
        <div className="flex items-center gap-3 px-3 py-2.5 sm:px-4">
          {/* Now playing */}
          <button
            type="button"
            onClick={() => setFullscreen(true)}
            className="flex min-w-0 flex-1 items-center gap-3 text-left lg:flex-none lg:w-72"
            aria-label="Open full screen player"
          >
            <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg">
              <Image src={cover} alt="" fill sizes="48px" className="object-cover" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">{track.name}</span>
              <span className="block truncate text-xs text-text-secondary">
                {artistLine(track)}
              </span>
            </span>
          </button>

          {/* Center: transport + seek (desktop) */}
          <div className="hidden flex-1 flex-col items-center gap-1.5 lg:flex">
            <TransportControls size="mini" />
            <div className="w-full max-w-xl">
              <SeekBar showTimes />
            </div>
          </div>

          {/* Right: extras (desktop) + compact controls (mobile) */}
          <div className="flex items-center gap-2 lg:w-72 lg:justify-end">
            <div className="hidden lg:flex lg:items-center lg:gap-2">
              <button
                type="button"
                aria-label="Queue"
                aria-pressed={queueOpen}
                onClick={() => setQueueOpen(!queueOpen)}
                className={`transition-colors duration-150 ${
                  queueOpen ? 'text-accent' : 'text-text-secondary hover:text-white'
                }`}
              >
                <Icon name="queue" size={20} />
              </button>
              <button
                type="button"
                aria-label="Full screen player"
                onClick={() => setFullscreen(true)}
                className="text-text-secondary transition-colors duration-150 hover:text-white"
              >
                <Icon name="expand" size={20} />
              </button>
              <VolumeControl />
            </div>

            {/* Mobile: just play/pause and next inline */}
            <div className="flex items-center lg:hidden">
              <TransportControls size="mini" />
            </div>
          </div>
        </div>

        {/* Mobile seek line under the row */}
        <div className="px-3 pb-2 lg:hidden">
          <SeekBar />
        </div>
      </div>
    </div>
  );
}
