'use client';

import { useEffect, useRef, useState } from 'react';
import { usePlayer } from '@/stores/player';

/**
 * A smooth playback position, interpolated between the engine's reports.
 *
 * **The problem.** `AudioEngine` reports progress on a 250ms interval, and only when the
 * position has moved by at least 0.25s. That is plenty for a seek bar, where a quarter of
 * a second is a fraction of a pixel, but karaoke highlighting driven by it visibly steps:
 * lines snap into place up to 250ms late, which against a sung vocal is obvious.
 *
 * **Why the engine is not changed instead.** Its ticker is a `setInterval` on purpose.
 * `requestAnimationFrame` is throttled or suspended entirely when the tab is backgrounded
 * or the phone is locked, which is exactly when playback must keep working: the progress
 * report drives `recordPlay`, the Media Session position and the end-of-track handoff.
 * Making the engine's clock finer would risk background playback to improve a visual
 * effect on a screen nobody is looking at.
 *
 * **The approach.** Take the engine's report as ground truth and extrapolate from it using
 * wall-clock time, on a `requestAnimationFrame` loop that only runs while this hook is
 * mounted (that is, while the lyrics pane is open). The engine stays authoritative and
 * corrects any drift four times a second; between corrections this fills the gap.
 *
 * `performance.now()` is used rather than `Date.now()` because it is monotonic. A system
 * clock adjustment, an NTP correction or a daylight-saving change would make `Date.now()`
 * jump, and the lyrics would leap forwards or backwards with it.
 */

/**
 * Beyond this much time since the last engine report, extrapolation is abandoned and the
 * engine's own value is used.
 *
 * Set generously on purpose. The engine reports roughly every 250ms but is allowed to skip
 * a report when the position has not moved far enough, so gaps approaching half a second
 * are normal operation, and during those extrapolation is *correct*: the audio really has
 * advanced. Falling back early would drag the highlight backwards, which is far more
 * noticeable than it being slightly ahead.
 *
 * What this actually guards is extrapolation having become nonsense rather than stale: a
 * stalled buffer while `isPlaying` is still true, or a tab that was backgrounded long
 * enough for the frame loop to freeze and then resumed.
 */
const MAX_DRIFT_S = 2;

export function usePlaybackClock(): number {
  const currentTime = usePlayer((state) => state.currentTime);
  const duration = usePlayer((state) => state.duration);
  const isPlaying = usePlayer((state) => state.isPlaying);
  const seekSeq = usePlayer((state) => state.seekSeq);

  const [interpolated, setInterpolated] = useState(currentTime);

  /**
   * The last report from the engine, and the wall-clock moment it arrived.
   *
   * Held in a ref and written from the animation loop's own effect rather than from render,
   * so updating it never schedules a render of its own.
   */
  const anchor = useRef({ position: currentTime, at: 0 });

  // Re-anchors whenever the engine reports, whenever playback starts or stops, and on every
  // seek. `seekSeq` is in the dependency list because a seek to a position within 0.25s of
  // the current one produces no visible change in `currentTime`, so without it a small
  // scrub would leave the interpolation running from the old anchor.
  useEffect(() => {
    anchor.current = { position: currentTime, at: performance.now() };
  }, [currentTime, isPlaying, seekSeq]);

  useEffect(() => {
    // Paused: the position cannot move on its own, so there is nothing to interpolate and no
    // reason to hold a frame loop open. The paused value is handled by the return statement
    // below rather than by writing state here, which would be a synchronous set inside an
    // effect and cause a cascading render.
    if (!isPlaying) return;

    let frame = 0;
    const tick = () => {
      const { position, at } = anchor.current;
      const elapsed = (performance.now() - at) / 1000;
      const projected = position + elapsed;
      // Never run past the end of the track, or the highlight would keep advancing through
      // the gap between the audio ending and the next track loading.
      const capped = duration > 0 ? Math.min(projected, duration) : projected;
      setInterpolated(elapsed > MAX_DRIFT_S ? position : capped);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // `currentTime` is deliberately absent. Including it would tear down and rebuild the
    // frame loop four times a second; the loop reads the latest report through the ref.
  }, [isPlaying, duration]);

  // While paused the engine's report is authoritative and exact, so it is returned
  // unmodified. Deriving the paused case here rather than storing it keeps one source of
  // truth for a position that is only ever interpolated during playback.
  return isPlaying ? interpolated : currentTime;
}
