'use client';

import Image from 'next/image';
import { m } from 'motion/react';
import { usePlayer } from '@/stores/player';
import { artistLine, pickImage } from '@/lib/utils';
import { Icon } from '@/components/ui/Icon';
import { LikeButton } from '@/components/library/LikeButton';

/**
 * Artwork card at the foot of the desktop sidebar.
 *
 * Desktop previously had no persistent view of the artwork at all: the toolbar
 * showed a 40px thumbnail and the only way to see the cover properly was to open
 * the full-screen player. Since the sidebar has vertical space going spare and the
 * artwork is the whole visual identity of the app, it belongs here.
 *
 * Deliberately not rendered when nothing is playing. An empty placeholder plate
 * would take the same space while saying nothing, and the sidebar's own promo card
 * already fills the gap. This differs from the toolbar's now-playing area, which
 * *does* keep a placeholder, because that one is in a horizontal row whose layout
 * would otherwise shift.
 */
export function SidebarNowPlaying() {
  const track = usePlayer((state) => state.currentTrack());
  const isPlaying = usePlayer((state) => state.isPlaying);
  const setFullscreen = usePlayer((state) => state.setFullscreen);

  if (!track) return null;

  const cover = pickImage(track.image);

  return (
    <m.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-3 overflow-hidden rounded-card-lg border border-white/10 bg-surface/70"
    >
      <button
        type="button"
        onClick={() => setFullscreen(true)}
        aria-label={`Open full screen player for ${track.name}`}
        className="group relative block w-full"
      >
        <span className="relative block aspect-square w-full overflow-hidden">
          <Image
            src={cover}
            alt=""
            fill
            sizes="232px"
            className="object-cover transition duration-500 group-hover:scale-[1.03]"
          />
          {/* The expand affordance only appears on hover. A permanently visible
              icon over album art competes with the artwork, which is the one thing
              on this card worth looking at. */}
          <span className="absolute inset-0 grid place-items-center bg-black/45 opacity-0 transition group-hover:opacity-100">
            <span className="grid h-11 w-11 place-items-center rounded-full bg-white/15 text-white backdrop-blur-glass">
              <Icon name="expand" size={22} />
            </span>
          </span>
        </span>
      </button>
      <div className="flex items-center gap-2 px-3 py-2.5">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-bold">{track.name}</p>
          <p className="mt-0.5 flex items-center gap-1.5 truncate text-[11px] text-text-secondary">
            {/* Equalizer bars, animated only while audio is actually running, so the
                card reads as "playing" versus "paused" without a second label. */}
            {isPlaying && (
              <span aria-hidden="true" className="flex h-3 shrink-0 items-end gap-[2px]">
                {[0, 1, 2].map((bar) => (
                  <span
                    key={bar}
                    className="w-[2px] origin-bottom rounded-full bg-accent"
                    style={{
                      height: '100%',
                      animation: `eqbar 900ms ease-in-out ${bar * 140}ms infinite`,
                    }}
                  />
                ))}
              </span>
            )}
            <span className="truncate">{artistLine(track)}</span>
          </p>
        </div>
        <LikeButton
          song={track}
          size={17}
          className="h-8 w-8 shrink-0 rounded-full hover:bg-white/10"
        />
      </div>
    </m.div>
  );
}
