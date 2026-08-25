'use client';

import Image from 'next/image';
import { usePlayer } from '@/stores/player';
import { artistLine, pickImage } from '@/lib/utils';
import { Icon } from '@/components/ui/Icon';
import { TransportControls } from './PlayerControls';
import { SeekBar } from './SeekBar';
import { VolumeControl } from './VolumeControl';

export function MiniPlayer() {
  const track = usePlayer((s) => s.currentTrack());
  const setFullscreen = usePlayer((s) => s.setFullscreen);
  const setQueueOpen = usePlayer((s) => s.setQueueOpen);
  const queueOpen = usePlayer((s) => s.queueOpen);

  if (!track) return null;
  const cover = pickImage(track.image, '150x150');

  return (
    <div className="fixed inset-x-0 bottom-16 z-40 lg:bottom-0 lg:left-60">
      <div className="border-t border-subtle bg-[#181818]">
        <div className="flex items-center gap-3 px-3 py-2.5 sm:px-4">
          <button
            type="button"
            onClick={() => setFullscreen(true)}
            className="flex min-w-0 flex-1 items-center gap-3 text-left lg:flex-none lg:w-72"
            aria-label="Open full screen player"
          >
            <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded">
              <Image src={cover} alt="" fill sizes="44px" className="object-cover" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">{track.name}</span>
              <span className="block truncate text-xs text-text-secondary">{artistLine(track)}</span>
            </span>
          </button>

          <div className="hidden flex-1 flex-col items-center gap-1.5 lg:flex">
            <TransportControls size="mini" />
            <div className="w-full max-w-xl"><SeekBar showTimes /></div>
          </div>

          <div className="flex items-center gap-2 lg:w-72 lg:justify-end">
            <div className="hidden lg:flex lg:items-center lg:gap-3">
              <button
                type="button"
                aria-label="Queue"
                aria-pressed={queueOpen}
                onClick={() => setQueueOpen(!queueOpen)}
                className={queueOpen ? 'text-accent' : 'text-text-secondary transition-colors hover:text-white'}
              >
                <Icon name="queue" size={20} />
              </button>
              <button
                type="button"
                aria-label="Full screen player"
                onClick={() => setFullscreen(true)}
                className="text-text-secondary transition-colors hover:text-white"
              >
                <Icon name="expand" size={20} />
              </button>
              <VolumeControl />
            </div>
            <div className="flex items-center lg:hidden"><TransportControls size="mini" /></div>
          </div>
        </div>
        <div className="px-3 pb-2 lg:hidden"><SeekBar /></div>
      </div>
    </div>
  );
}
