'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { Song } from '@/lib/types';
import { usePlayer } from '@/stores/player';
import { Icon } from '@/components/ui/Icon';
import { SampleCard } from './SampleCard';

/**
 * Length of each preview. Long enough to know whether you like it, short enough that the feed keeps
 * moving. Matches the 30 seconds the brief asked for.
 */
const CLIP_SECONDS = 30;

/**
 * Where in the track the preview starts, as a fraction.
 *
 * Not zero. Most tracks open with an intro, and a preview that begins at 0:00 shows the least
 * characteristic part of the song. A quarter of the way in is usually the first verse or the hook,
 * which is what a listener is deciding on.
 */
const CLIP_START_RATIO = 0.25;

/**
 * The samples feed: a vertical, snapping, one-track-per-screen preview reel.
 *
 * How playback works, and why it works this way:
 *
 * The app has a single audio engine with a single queue, so a feed cannot run its own parallel
 * player without fighting it. Instead the visible card *takes over* the queue: scrolling to a card
 * calls `playQueue` with that one track. That keeps the engine, the Media Session, the theme
 * palette and the play history all working normally, with no special cases.
 *
 * Seeking into the clip is the fiddly part. `seekTo` clamps to zero whenever `duration` is zero,
 * which it always is in the moment right after a new track is queued and before its metadata has
 * loaded. So the seek cannot happen at queue time; it has to wait for the engine to report a real
 * duration. That is what the `seekedFor` ref tracks: the seek fires once per track, on the first
 * render where the duration for *that* track is known.
 *
 * Leaving the feed deliberately does not restore whatever was playing before. There is no
 * store action to restore a queue mid-track, and faking it by re-queuing would restart the track
 * from zero, which is worse than simply leaving the sample as the current track. "Play full song"
 * on each card is the intended way out.
 */
export function SamplesFeed({ songs }: { songs: Song[] }) {
  const playQueue = usePlayer((state) => state.playQueue);
  const seekTo = usePlayer((state) => state.seekTo);
  const currentTime = usePlayer((state) => state.currentTime);
  const duration = usePlayer((state) => state.duration);
  const currentId = usePlayer((state) => state.currentTrack()?.id);

  const [activeIndex, setActiveIndex] = useState(0);
  /** Which track id the clip seek has already been applied for. */
  const seekedFor = useRef<string | null>(null);

  const activeSong = songs[activeIndex];

  // Scrolling to a card takes over the queue. Guarded on the id so re-renders do not restart the
  // track, which would make the preview stutter.
  useEffect(() => {
    if (!activeSong) return;
    if (currentId === activeSong.id) return;
    seekedFor.current = null;
    playQueue([activeSong], 0);
  }, [activeSong, currentId, playQueue]);

  // The deferred seek into the clip. Runs on the first frame where this track's duration is known.
  useEffect(() => {
    if (!activeSong || currentId !== activeSong.id) return;
    if (seekedFor.current === activeSong.id) return;
    if (duration <= 0) return;
    seekedFor.current = activeSong.id;
    // Never seek so far in that the clip would run past the end of a short track.
    const start = Math.max(0, Math.min(duration * CLIP_START_RATIO, duration - CLIP_SECONDS));
    if (start > 0) seekTo(start);
  }, [activeSong, currentId, duration, seekTo]);

  // Loop the clip rather than letting it run into the rest of the track. A preview that quietly
  // becomes a full play would make the feed stop being a feed.
  const clipStart =
    duration > 0 ? Math.max(0, Math.min(duration * CLIP_START_RATIO, duration - CLIP_SECONDS)) : 0;

  useEffect(() => {
    if (!activeSong || currentId !== activeSong.id) return;
    // Only once the clip's own seek has landed. Without this guard the loop could fire during the
    // window where the track is queued but still positioned at zero.
    if (duration <= 0 || seekedFor.current !== activeSong.id) return;
    if (currentTime > clipStart + CLIP_SECONDS) seekTo(clipStart);
  }, [currentTime, clipStart, duration, activeSong, currentId, seekTo]);

  // Which card is in view. An observer rather than a scroll handler, because a snapping container
  // reports many intermediate positions and only the settled one matters.
  const observe = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    if (typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          // A majority threshold, so the switch happens once a card genuinely owns the screen
          // rather than as soon as it peeks in.
          if (entry.isIntersecting && entry.intersectionRatio > 0.6) {
            const index = Number((entry.target as HTMLElement).dataset.index);
            if (Number.isInteger(index)) setActiveIndex(index);
          }
        }
      },
      { root: node, threshold: [0.6] },
    );
    for (const child of Array.from(node.children)) observer.observe(child);
    return () => observer.disconnect();
  }, []);

  if (songs.length === 0) {
    return (
      <div className="app-page">
        <section className="premium-panel p-8 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-accent/10 text-accent-soft ring-1 ring-accent/30">
            <Icon name="samples" size={25} />
          </span>
          <h1 className="mt-4 text-h4 font-extrabold">No samples right now</h1>
          <p className="mx-auto mt-2 max-w-md text-[14px] leading-relaxed text-text-secondary">
            The catalogue could not be reached, so there is nothing to preview.
          </p>
          <Link href="/" className="button-primary mt-6">
            Back to home
          </Link>
        </section>
      </div>
    );
  }

  /**
   * Progress through the clip, derived purely from the reported position.
   *
   * No need to know whether the seek has landed yet: before it does, `currentTime` is near zero
   * while `clipStart` is well past it, so the expression is negative and clamps to zero. Deriving
   * it this way also keeps the seek-once bookkeeping out of the render path, where reading a ref
   * is not allowed.
   */
  const progress =
    duration > 0 ? Math.max(0, Math.min(1, (currentTime - clipStart) / CLIP_SECONDS)) : 0;

  return (
    /*
      A fixed, full-viewport takeover rather than a page in the normal flow.
      
      Two reasons. The app shell adds bottom padding to clear the player bar and tab bar, which
      would push a full-height snap card out of alignment and leave dead space below the feed. And a
      preview reel *is* a player, so it should cover the persistent player bar rather than compete
      with it, which `z-[45]` does: above the bar at `z-40`, below the full screen player at `z-50`.
      
      It cannot live outside the `(main)` layout, incidentally, because that is where the audio
      engine is mounted.
    */
    <div className="fixed inset-0 z-[45] bg-bg">
      <Link
        href="/"
        aria-label="Leave samples"
        className="absolute left-4 top-4 z-30 grid h-10 w-10 place-items-center rounded-full bg-black/45 text-white backdrop-blur-glass"
      >
        <Icon name="close" size={20} />
      </Link>

      <p className="absolute left-1/2 top-5 z-30 -translate-x-1/2 text-[11px] font-bold uppercase tracking-[0.15em] text-white/70">
        Samples
      </p>

      {/*
        `h-full` against the fixed parent, and `overscroll-y-contain` so reaching the end of the feed
        does not start scrolling the page underneath it.
      */}
      <div
        ref={observe}
        className="no-scrollbar h-full snap-y snap-mandatory overflow-y-scroll overscroll-y-contain"
      >
        {songs.map((song, index) => (
          <div key={`${song.id}-${index}`} data-index={index} className="h-full w-full">
            <SampleCard
              song={song}
              active={index === activeIndex}
              all={songs}
              progress={index === activeIndex ? progress : 0}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
