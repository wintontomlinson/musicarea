'use client';

import { useEffect, useMemo, useRef } from 'react';
import type { Song } from '@/lib/types';
import { activeLineIndex } from '@/lib/lyrics';
import { usePlayer } from '@/stores/player';
import { usePlaybackClock } from '@/hooks/usePlaybackClock';
import { useLyrics } from '@/hooks/useLyrics';
import { Icon } from '@/components/ui/Icon';
import { Skeleton } from '@/components/ui/Skeleton';
import { LyricLine } from './LyricLine';

/**
 * The lyrics view: karaoke when timings exist, a reading view when they do not.
 *
 * Both modes are first-class. LRCLIB, the only source with timings available here, covers
 * Bollywood and regional Indian music far less thoroughly than Western pop, so for this
 * catalogue the untimed reading view is the common experience rather than a fallback. It gets
 * the same typography and centring, minus the highlight and the auto-scroll.
 *
 * Auto-scroll is the fiddly part. Three rules, in order of precedence:
 *
 * 1. Scrolling by hand suspends following, because nothing is more annoying than a view that
 *    yanks itself back while you are reading ahead.
 * 2. Following resumes after a few seconds of no interaction, so the suspension does not
 *    become permanent.
 * 3. A track change or a seek resumes it immediately, since both are explicit signals that the
 *    listener wants to be where the music is.
 */

/** How long hand-scrolling suspends auto-follow. */
const RESUME_AFTER_MS = 4500;

/** Shared so the "no lyrics" case has a stable array identity. */
const NO_LINES: never[] = [];

export function LyricsPane({ song, active }: { song: Song | null; active: boolean }) {
  const state = useLyrics(song, active);
  const time = usePlaybackClock();
  const seekTo = usePlayer((player) => player.seekTo);
  const seekSeq = usePlayer((player) => player.seekSeq);

  const scrollerRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLDivElement>(null);
  /** Set while the listener is scrolling by hand; cleared on a timer. */
  const holdRef = useRef(0);
  /** Distinguishes our own programmatic scrolling from the listener's. */
  const selfScrollRef = useRef(false);

  const lyrics = state.kind === 'ready' ? state.lyrics : null;
  // Memoised with a shared empty constant, so the identity is stable between renders. Without
  // that, a fresh `[]` on every render would invalidate the memo below on every animation frame,
  // which is sixty binary searches a second instead of one per line change.
  const lines = useMemo(
    () => (lyrics && 'lines' in lyrics ? lyrics.lines : NO_LINES),
    [lyrics],
  );
  const synced = lyrics?.kind === 'synced';

  const current = useMemo(
    () => (synced && lines.length ? activeLineIndex(lines, time) : -1),
    [synced, lines, time],
  );

  // Follow the active line. Scoped to `current` rather than `time`, so this runs when the line
  // changes rather than on every one of the sixty frames a second the clock produces.
  useEffect(() => {
    if (!synced || current < 0) return;
    if (Date.now() < holdRef.current) return;
    const node = activeRef.current;
    if (!node) return;

    selfScrollRef.current = true;
    node.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // `scrollIntoView` fires scroll events that would otherwise look like the listener
    // scrolling and immediately suspend following. Smooth scrolling can run for a few hundred
    // milliseconds, so the flag is held past the end of the animation.
    const clear = window.setTimeout(() => {
      selfScrollRef.current = false;
    }, 700);
    return () => window.clearTimeout(clear);
  }, [current, synced]);

  // A seek is an explicit request to be where the music is, so it cancels any hold.
  useEffect(() => {
    holdRef.current = 0;
  }, [seekSeq, song?.id]);

  function onUserScroll() {
    if (selfScrollRef.current) return;
    holdRef.current = Date.now() + RESUME_AFTER_MS;
  }

  if (!song) return null;

  if (state.kind === 'loading') {
    return (
      <div className="flex flex-col items-center gap-4 px-6 py-10">
        {/* Uneven widths, because lyric lines are uneven. A stack of identical bars reads as
            a loading component; a ragged one reads as text about to appear. */}
        {['w-4/5', 'w-3/5', 'w-[72%]', 'w-1/2'].map((width) => (
          <Skeleton key={width} className={`h-6 rounded-full ${width}`} />
        ))}
      </div>
    );
  }

  if (!lyrics || lyrics.kind === 'none') {
    return (
      <Empty
        icon="lyrics"
        title="No lyrics for this one"
        message="Nothing was found for this track. Lyrics come from open community sources and the catalogue, so coverage varies by release."
      />
    );
  }

  if (lyrics.kind === 'instrumental') {
    return (
      <Empty
        icon="disc"
        title="Instrumental"
        message="This recording has no vocals to follow."
      />
    );
  }

  return (
    <div
      ref={scrollerRef}
      onScroll={onUserScroll}
      onWheel={onUserScroll}
      onTouchMove={onUserScroll}
      className="h-full overflow-y-auto px-4 sm:px-8"
    >
      {/* Generous padding top and bottom so the first and last lines can still reach the
          vertical centre of the pane when scrolled to. Without it `block: 'center'` cannot
          centre them and the highlight sits at the edge for the opening and closing lines. */}
      <div className="flex flex-col py-[35vh]">
        {lines.map((line, index) => {
          const isActive = synced && index === current;
          return (
            <div key={`${index}-${line.time ?? 'x'}`} ref={isActive ? activeRef : undefined}>
              <LyricLine
                text={line.text}
                distance={synced ? index - current : 0}
                flat={!synced}
                onSeek={
                  synced && line.time !== null
                    ? () => {
                        holdRef.current = 0;
                        seekTo(line.time as number);
                      }
                    : undefined
                }
              />
            </div>
          );
        })}

        <div className="mt-8 space-y-1 text-center">
          {/* Attribution, and an honest statement of which mode this is. A listener who
              expected the words to follow the music should be told why they do not. */}
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
            {synced ? 'Synced lyrics' : 'Lyrics not time-synced for this track'}
          </p>
          <p className="text-[11px] text-text-muted">
            {lyrics.source === 'lrclib' ? 'Provided by LRCLIB' : 'Provided by the catalogue'}
          </p>
          {lyrics.copyright && (
            <p className="mx-auto max-w-md text-[10.5px] leading-relaxed text-text-muted/80">
              {lyrics.copyright}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function Empty({
  icon,
  title,
  message,
}: {
  icon: 'lyrics' | 'disc';
  title: string;
  message: string;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-full bg-white/[0.07] text-text-secondary">
        <Icon name={icon} size={22} />
      </span>
      <p className="text-h5 font-bold">{title}</p>
      <p className="max-w-sm text-[13px] leading-relaxed text-text-secondary">{message}</p>
    </div>
  );
}
