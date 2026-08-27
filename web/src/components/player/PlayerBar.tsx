'use client';

import Image from 'next/image';
import { AnimatePresence, m } from 'motion/react';
import { usePlayer } from '@/stores/player';
import { artistLine, pickImage } from '@/lib/utils';
import { Icon } from '@/components/ui/Icon';
import { Marquee } from '@/components/ui/Marquee';
import { LikeButton } from '@/components/library/LikeButton';
import { MOBILE_NAV_HEIGHT } from '@/components/layout/MobileNav';
import { SPRING_SOFT } from '@/lib/motion';
import { TransportControls } from './PlayerControls';
import { SeekBar } from './SeekBar';
import { VolumeControl } from './VolumeControl';
import { QualityBadge } from './QualityBadge';

/** Height of the desktop bar, in pixels. */
const PLAYER_BAR_HEIGHT = 72;

/**
 * The persistent player.
 *
 * This replaces two separate components. Mobile had a floating `MiniPlayer` and
 * desktop had a `NowPlayingBar` nested inside the top toolbar, which meant the same
 * transport logic existed twice, the desktop player was in the wrong place
 * architecturally, and the two drifted apart visually. One responsive component
 * removes that split.
 *
 * The two layouts are genuinely different rather than one squeezed into the other:
 *
 * **Mobile** is a floating rounded card above the tab bar, with a progress hairline
 * across the top and only the three controls a thumb needs. Tapping the artwork or
 * the title opens the full player, matching every mobile music app.
 *
 * **Desktop** is a full-width bar in three columns: track on the left, transport and
 * scrub rail in a centred column, secondary controls on the right. The centre column
 * is centred on the viewport rather than on the space left over, which is why it is a
 * three-column grid with equal outer tracks instead of a flex row.
 *
 * Returns null with nothing queued. The old desktop bar rendered a "Choose a track"
 * placeholder to stop the toolbar changing shape, but as a bottom bar there is no
 * layout to preserve, and an empty bar permanently occupying 72px is worse than the
 * page simply being taller.
 */
export function PlayerBar() {
  const track = usePlayer((state) => state.currentTrack());
  const isPlaying = usePlayer((state) => state.isPlaying);
  const isLoading = usePlayer((state) => state.isLoading);
  const currentTime = usePlayer((state) => state.currentTime);
  const duration = usePlayer((state) => state.duration);
  const queueOpen = usePlayer((state) => state.queueOpen);
  const lyricsOpen = usePlayer((state) => state.lyricsOpen);
  const toggle = usePlayer((state) => state.toggle);
  const next = usePlayer((state) => state.next);
  const setFullscreen = usePlayer((state) => state.setFullscreen);
  const setQueueOpen = usePlayer((state) => state.setQueueOpen);
  const setLyricsOpen = usePlayer((state) => state.setLyricsOpen);

  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <AnimatePresence>
      {track && (
        <>
          {/* ---------------------------------------------------------------- */}
          {/* Mobile: floating card above the tab bar                           */}
          {/* ---------------------------------------------------------------- */}
          <m.div
            key="mobile"
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={SPRING_SOFT}
            // Offset by the nav's own height plus the safe-area inset, read from the
            // nav module rather than hardcoded, so the two cannot drift apart.
            style={{ bottom: `calc(${MOBILE_NAV_HEIGHT}px + env(safe-area-inset-bottom))` }}
            className="fixed inset-x-0 z-40 px-2 lg:hidden"
          >
            <div className="relative overflow-hidden rounded-card-lg border border-subtle bg-surface-raised/95 shadow-[0_12px_35px_-12px_rgb(var(--accent-rgb)/.4)] backdrop-blur-glass">
              <div className="flex items-center gap-2 p-2">
                <button
                  type="button"
                  onClick={() => setFullscreen(true)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  aria-label={`Open full screen player for ${track.name}`}
                >
                  <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-[10px] border border-white/15">
                    <Image src={pickImage(track.image, '150x150')} alt="" fill sizes="44px" className="object-cover" />
                  </span>
                  <span className="min-w-0 flex-1">
                    {/* Only the title scrolls, and only while audio is running. A
                        marquee on a paused track is motion for its own sake. */}
                    <Marquee
                      text={track.name}
                      active={isPlaying}
                      className="text-[14px] font-bold leading-tight"
                    />
                    <span className="block truncate text-[12px] leading-tight text-text-secondary">
                      {artistLine(track)}
                    </span>
                  </span>
                </button>
                <LikeButton song={track} size={20} className="h-10 w-10 shrink-0 rounded-full" />
                <button
                  type="button"
                  aria-label={isPlaying ? 'Pause' : 'Play'}
                  onClick={toggle}
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand text-on-accent shadow-glow"
                >
                  {isLoading ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-on-accent/30 border-t-on-accent" aria-hidden="true" />
                  ) : (
                    <Icon name={isPlaying ? 'pause' : 'play'} size={18} />
                  )}
                </button>
                <button
                  type="button"
                  aria-label="Next"
                  onClick={() => next(false)}
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-white"
                >
                  <Icon name="next" size={21} />
                </button>
              </div>
              {/* A read-only hairline, not a scrub target: at this width a drag would
                  be far too imprecise to be useful, and the full player has a proper
                  rail. */}
              <div className="absolute inset-x-0 top-0 h-[2px] bg-white/10" aria-hidden="true">
                <div className="h-full bg-brand transition-[width] duration-200 ease-linear" style={{ width: `${progress}%` }} />
              </div>
            </div>
          </m.div>

          {/* ---------------------------------------------------------------- */}
          {/* Desktop: full-width three-column bar                             */}
          {/* ---------------------------------------------------------------- */}
          <m.div
            key="desktop"
            initial={{ y: 90 }}
            animate={{ y: 0 }}
            exit={{ y: 90 }}
            transition={SPRING_SOFT}
            style={{ height: PLAYER_BAR_HEIGHT }}
            className="chrome-panel fixed inset-x-0 bottom-0 z-40 hidden border-t border-white/10 px-4 [--chrome-alpha:0.94] lg:block"
          >
            {/* Equal outer columns keep the transport centred on the viewport rather
                than on whatever space the track and controls leave behind, which is
                what stops the play button drifting as titles change length. */}
            <div className="mx-auto grid h-full w-full max-w-[1680px] grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <button
                  type="button"
                  onClick={() => setFullscreen(true)}
                  aria-label={`Open full screen player for ${track.name}`}
                  className="group relative h-12 w-12 shrink-0 overflow-hidden rounded-[10px] border border-white/15"
                >
                  <Image src={pickImage(track.image, '150x150')} alt="" fill sizes="48px" className="object-cover" />
                  <span className="absolute inset-0 grid place-items-center bg-black/50 opacity-0 transition group-hover:opacity-100">
                    <Icon name="expand" size={18} />
                  </span>
                </button>
                <div className="min-w-0">
                  <Marquee text={track.name} active={isPlaying} className="text-[13.5px] font-bold leading-tight" />
                  <span className="block truncate text-[12px] leading-tight text-text-secondary">
                    {artistLine(track)}
                  </span>
                </div>
                <LikeButton song={track} size={17} className="h-8 w-8 shrink-0 rounded-full hover:bg-white/10" />
              </div>

              <div className="flex w-[min(38vw,460px)] flex-col items-center gap-0.5">
                <TransportControls size="bar" />
                <SeekBar showTimes className="w-full" />
              </div>

              <div className="flex items-center justify-end gap-1.5">
                <QualityBadge className="mr-1" />
                <BarToggle
                  label="Lyrics"
                  icon="lyrics"
                  active={lyricsOpen}
                  // Lyrics live inside the full-screen player, so this both opens the
                  // player and selects that pane. Showing lyrics in the bar itself was
                  // considered and dropped: one line of karaoke in a 72px strip is not
                  // legible enough to be worth the space.
                  onClick={() => {
                    setLyricsOpen(true);
                    setFullscreen(true);
                  }}
                />
                <BarToggle
                  label="Queue"
                  icon="queue"
                  active={queueOpen}
                  onClick={() => setQueueOpen(!queueOpen)}
                />
                <VolumeControl />
              </div>
            </div>
          </m.div>
        </>
      )}
    </AnimatePresence>
  );
}

function BarToggle({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon: 'lyrics' | 'queue';
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={`grid h-9 w-9 shrink-0 place-items-center rounded-full transition ${
        active
          ? 'bg-accent text-on-accent shadow-glow'
          : 'text-text-secondary hover:bg-white/10 hover:text-white'
      }`}
    >
      <Icon name={icon} size={18} />
    </button>
  );
}
