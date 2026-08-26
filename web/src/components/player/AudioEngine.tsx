'use client';

import { useEffect, useRef } from 'react';
import { Howl, Howler } from 'howler';
import { usePlayer } from '@/stores/player';
import { useLibrary } from '@/stores/library';
import { useHistory } from '@/stores/history';
import type { Song } from '@/lib/types';
import { pickStream, type ChosenStream } from '@/lib/utils';
import { equalPowerGains } from '@/lib/crossfade';
import { attachElement, resumeContext, supportsCors } from '@/lib/audioGraph';

/**
 * The HTML5 media element behind a Howl.
 *
 * Howler does not expose it, and the visualizer needs the element itself to route
 * it into the audio graph. Reaching into `_sounds` is the only way; it is narrowed
 * rather than asserted, so a change in Howler's internals turns the visualizer off
 * instead of throwing.
 */
function mediaElementOf(howl: Howl): HTMLMediaElement | null {
  const sounds = (howl as unknown as { _sounds?: Array<{ _node?: unknown }> })._sounds;
  const node = sounds?.[0]?._node;
  return node instanceof HTMLMediaElement ? node : null;
}

/**
 * The audio engine. Always mounted, renders nothing, exists for its effects.
 *
 * Two decks rather than one. A single sound cannot overlap itself, so a handover
 * is either a gap or a cut; with two, the outgoing track can still be sounding
 * while the incoming one rises under it. The idle deck also doubles as the buffer
 * for the next track, which is what makes the crossfade-off path gapless.
 *
 * The store is the source of truth for *intent*, the engine for *position*. Those
 * travel in opposite directions and never share a channel: `setProgress` only
 * flows engine to store, and a seek only arrives as a `seekSeq` bump. Inferring
 * seeks by diffing `currentTime` cannot express a seek to 0:00 at all.
 */

/** Skip past this many unplayable tracks before giving up on the queue. */
const MAX_CONSECUTIVE_FAILURES = 5;

/**
 * Seconds of playback before a track counts as a `play` for the taste profile.
 * Logging on load would let scrolling a shelf rewrite someone's taste.
 */
const PLAY_THRESHOLD_SECONDS = 12;

/** Fraction of a track that must be heard for its end to count as a `complete`. */
const COMPLETE_RATIO = 0.9;

/**
 * How far ahead of the blend to start buffering the next track.
 *
 * This is the part that decides whether a crossfade sounds right. Fetching the
 * incoming track at the moment the fade begins works on a fast connection and
 * falls apart on anything slower: the incoming side starts silent and leaves a
 * hole in the middle of the blend.
 */
const PRELOAD_LEAD_SECONDS = 15;

/**
 * The handover used when crossfade is off. Short enough to be inaudible, but it
 * means the changeover reuses the already-buffered deck rather than stalling
 * while the next track loads.
 */
const GAPLESS_BLEND_SECONDS = 0.06;

/** A skip should feel immediate, so its blend is capped well below the setting. */
const SKIP_BLEND_SECONDS = 1.2;

/** Fade applied when cutting to a track that was not buffered, to avoid a click. */
const HARD_CUT_FADE_SECONDS = 0.12;

/** Ramp resolution. Fine enough to be smooth, coarse enough to be cheap. */
const RAMP_INTERVAL_MS = 40;

interface Deck {
  howl: Howl;
  songId: string;
  song: Song;
  stream: ChosenStream;
  /** Fading out and about to be discarded. Must not drive store state. */
  retiring: boolean;
  /** Furthest position reached, for deciding whether the end was a real listen. */
  maxProgress: number;
  /** A play is logged once per load, not once per tick. */
  playLogged: boolean;
  /** The finish has been recorded, so `onend` must not record it again. */
  endLogged: boolean;
  /** A handover has already been started from this deck. */
  handedOver: boolean;
}

export function AudioEngine() {
  const decksRef = useRef<Array<Deck | null>>([null, null]);
  const activeRef = useRef(0);
  const tickRef = useRef<number | null>(null);
  const rampRef = useRef<number | null>(null);
  const loadTicketRef = useRef([0, 0]);
  const failuresRef = useRef(0);
  /** Position to restore once a reloaded source reports its duration. */
  const resumeAtRef = useRef<number | null>(null);
  /** Song id currently being preloaded onto the idle deck, to avoid duplicate work. */
  const preloadingRef = useRef<string | null>(null);

  useEffect(() => {
    const idle = () => (activeRef.current === 0 ? 1 : 0);
    const activeDeck = () => decksRef.current[activeRef.current];
    const idleDeck = () => decksRef.current[idle()];

    function stopTicker() {
      if (tickRef.current !== null) {
        window.clearInterval(tickRef.current);
        tickRef.current = null;
      }
    }

    function stopRamp() {
      if (rampRef.current !== null) {
        window.clearInterval(rampRef.current);
        rampRef.current = null;
      }
    }

    function destroyDeck(slot: number) {
      const deck = decksRef.current[slot];
      if (!deck) return;
      // Mark first: unload fires `onpause`, which must not reach the store.
      deck.retiring = true;
      deck.howl.unload();
      decksRef.current[slot] = null;
      loadTicketRef.current[slot] += 1;
    }

    /**
     * Abandon any blend in progress and leave only the active deck sounding.
     * Called before starting anything new, so a retiring track can never keep
     * playing underneath.
     */
    function cancelBlend() {
      stopRamp();
      const other = idleDeck();
      if (other?.retiring) destroyDeck(idle());
      const deck = activeDeck();
      if (deck) deck.howl.volume(1);
    }

    /** The track that would play next, without advancing the queue to find out. */
    function peekNext(): Song | null {
      const { order, orderPos, queue, repeat } = usePlayer.getState();
      // Repeat-one replays the same track, so there is no handover to prepare and
      // crossfading a track into itself would only double it against itself.
      if (repeat === 'one' || !order.length) return null;
      if (orderPos < order.length - 1) return queue[order[orderPos + 1]] ?? null;
      if (repeat === 'all') return queue[order[0]] ?? null;
      return null;
    }

    async function resolveStream(song: Song): Promise<ChosenStream | null> {
      const requested = usePlayer.getState().quality;
      const direct = pickStream(song, requested);
      if (direct) return direct;
      // A slim record stored without its stream URLs; fetch full details.
      try {
        const res = await fetch(`/api/song/${encodeURIComponent(song.id)}`);
        if (!res.ok) return null;
        const full = (await res.json()) as Song[] | { data?: Song[] };
        const list = Array.isArray(full) ? full : full.data;
        return list && list[0] ? pickStream(list[0], requested) : null;
      } catch {
        return null;
      }
    }

    /**
     * Record how a track finished. Heard through to the end is a much stronger
     * taste signal than merely started, and a replay under repeat-one stronger
     * still, so the three are logged as different events.
     */
    function logEnd(deck: Deck) {
      if (deck.endLogged) return;
      deck.endLogged = true;
      const duration = deck.howl.duration() || 0;
      const ratio = duration > 0 ? deck.maxProgress / duration : 0;
      if (usePlayer.getState().repeat === 'one') {
        useHistory.getState().log(deck.song, 'repeat');
        return;
      }
      useHistory.getState().log(deck.song, ratio >= COMPLETE_RATIO ? 'complete' : 'play');
    }

    function bailOut() {
      failuresRef.current = 0;
      const s = usePlayer.getState();
      s.setLoading(false);
      s.setPlaying(false);
      s.setPlaybackError(
        'Nothing in this queue could be streamed. Check your connection and try again.',
      );
    }

    function handleFailure() {
      failuresRef.current += 1;
      const { queue } = usePlayer.getState();
      const limit = Math.min(MAX_CONSECUTIVE_FAILURES, Math.max(1, queue.length));
      if (failuresRef.current >= limit) {
        bailOut();
        return;
      }
      usePlayer.getState().next(true);
    }

    /**
     * Build a deck for a song in the given slot.
     *
     * `autoplay` false is the preload path: the sound is created and buffered but
     * left silent and paused, ready for the blend to reuse. Reassigning a source
     * at fade time would throw that buffer away, which is the whole point of it.
     */
    async function buildDeck(
      slot: number,
      song: Song,
      opts: { autoplay: boolean; startVolume?: number } = { autoplay: true },
    ): Promise<Deck | null> {
      const ticket = ++loadTicketRef.current[slot];
      const stream = await resolveStream(song);
      // A newer load for this slot, or a teardown, superseded this one.
      if (loadTicketRef.current[slot] !== ticket) return null;
      if (!stream) return null;

      // Decide about the visualizer before the element exists, because it cannot
      // be decided afterwards: `crossOrigin` has to be set before a source is
      // assigned, and getting it wrong either silences the track or stops it
      // loading. See lib/audioGraph.ts.
      let canVisualize = false;
      if (usePlayer.getState().visualizer) {
        canVisualize = await supportsCors(stream.url);
        if (loadTicketRef.current[slot] !== ticket) return null;
        // Report the verdict once, so the setting can explain itself instead of
        // looking broken.
        usePlayer.getState().setVisualizerUnavailable(!canVisualize);
      }

      return await new Promise<Deck | null>((resolve) => {
        let settled = false;
        const howl = new Howl({
          src: [stream.url],
          // Stream through an HTML5 audio element rather than the Web Audio
          // graph. Required for long AAC files, and it is what lets playback
          // continue when the tab is backgrounded or the screen locks.
          html5: true,
          format: ['mp4', 'aac', 'm4a'],
          // Per-deck gain is the fade control. Howler multiplies this by the
          // master gain, so the master stays at the listener's volume and this
          // only ever expresses the crossfade position. A deck at rest sits at 1.
          volume: opts.startVolume ?? 1,
          // Loading is kicked off explicitly below, after this deck is recorded.
          // Constructing with `preload: true` can complete before the assignment
          // and leave the handlers unable to find their own deck.
          preload: false,
          onload: () => {
            if (loadTicketRef.current[slot] !== ticket) {
              howl.unload();
              if (!settled) {
                settled = true;
                resolve(null);
              }
              return;
            }
            if (slot === activeRef.current) {
              const s = usePlayer.getState();
              failuresRef.current = 0;
              s.setLoading(false);
              s.setPlaybackError(null);
              s.setActiveStream(stream.quality, stream.steppedDown);

              // Restore the position after a quality change. The seek must wait
              // for a duration: assigning a time to a media element still in
              // HAVE_NOTHING is silently dropped, so an earlier attempt would
              // look like it worked and restart the track instead.
              const resumeAt = resumeAtRef.current;
              resumeAtRef.current = null;
              const duration = howl.duration() || 0;
              if (resumeAt && resumeAt > 0 && resumeAt < duration) {
                howl.seek(resumeAt);
                s.setProgress(resumeAt, duration);
              } else {
                s.setProgress(0, duration);
              }
            }
            if (!settled) {
              settled = true;
              resolve(decksRef.current[slot]);
            }
          },
          onplay: () => {
            const deck = decksRef.current[slot];
            if (!deck || deck.retiring) return;
            usePlayer.getState().setPlaying(true);
            // The audio context starts suspended until a gesture; starting
            // playback is one.
            resumeContext();
            // Recorded on play rather than load, so skipping through a queue does
            // not fill the recent list with tracks nobody heard.
            useLibrary.getState().recordPlay(song);
            if (slot === activeRef.current) startTicker();
          },
          onpause: () => {
            const deck = decksRef.current[slot];
            // A deck fading out pauses on its way to being discarded. Letting
            // that reach the store would report playback as stopped while the
            // incoming track is audible.
            if (!deck || deck.retiring || slot !== activeRef.current) return;
            usePlayer.getState().setPlaying(false);
            stopTicker();
          },
          onend: () => {
            const deck = decksRef.current[slot];
            if (!deck) return;
            // A handover already advanced the queue; this is just the old track
            // running out underneath the new one.
            if (deck.retiring || deck.handedOver) return;
            stopTicker();
            logEnd(deck);
            usePlayer.getState().next(true);
          },
          onloaderror: () => {
            if (slot === activeRef.current) {
              usePlayer.getState().setLoading(false);
              handleFailure();
            }
            if (!settled) {
              settled = true;
              resolve(null);
            }
          },
          onplayerror: () => {
            // Autoplay can be blocked until a user gesture; Howler recovers on
            // unlock.
            howl.once('unlock', () => {
              if (usePlayer.getState().isPlaying && slot === activeRef.current) howl.play();
            });
          },
        });

        const deck: Deck = {
          howl,
          songId: song.id,
          song,
          stream,
          retiring: false,
          maxProgress: 0,
          playLogged: false,
          endLogged: false,
          handedOver: false,
        };
        decksRef.current[slot] = deck;

        // Wire up the analyser while the element is still sourceless. Howler owns
        // the element, so this reaches past its public surface; it is guarded and
        // failure here only costs the visualizer, never playback.
        if (canVisualize) {
          const element = mediaElementOf(howl);
          if (element) {
            element.crossOrigin = 'anonymous';
            if (!attachElement(element)) {
              usePlayer.getState().setVisualizerUnavailable(true);
            }
          }
        }

        // Now that the deck is findable, start fetching. Playback waits for
        // `onload` on the preload path; on the active path Howler queues the play
        // and honours it once the source is ready.
        howl.load();

        if (opts.autoplay && usePlayer.getState().isPlaying) howl.play();
      });
    }

    /** Ramp from one deck to another. See `equalPowerGains` for the curve. */
    function ramp(fromSlot: number, toSlot: number, seconds: number) {
      stopRamp();
      const from = decksRef.current[fromSlot];
      const to = decksRef.current[toSlot];
      if (!to) return;
      if (!from) {
        to.howl.volume(1);
        return;
      }

      const startedAt = performance.now();
      const durationMs = Math.max(GAPLESS_BLEND_SECONDS, seconds) * 1000;

      const step = () => {
        const p = Math.min(1, (performance.now() - startedAt) / durationMs);
        const { outgoing, incoming } = equalPowerGains(p);
        if (decksRef.current[fromSlot] === from) from.howl.volume(outgoing);
        if (decksRef.current[toSlot] === to) to.howl.volume(incoming);
        if (p >= 1) {
          stopRamp();
          if (decksRef.current[fromSlot] === from) destroyDeck(fromSlot);
          if (decksRef.current[toSlot] === to) to.howl.volume(1);
        }
      };

      rampRef.current = window.setInterval(step, RAMP_INTERVAL_MS);
    }

    /**
     * Promote the idle deck to active and fade the old one out under it.
     *
     * `advance` moves the queue pointer as part of the same operation. It has to
     * happen here, between promoting the deck and reporting the new position,
     * because `next()` zeroes `currentTime` and `duration`: advancing afterwards
     * would blank the seek bar until the next tick, and advancing beforehand would
     * make the subscription treat this as a skip and pick a different blend
     * length. When the queue has already moved (a skip into a buffered track),
     * the caller passes false.
     */
    function handOver(seconds: number, advance: boolean) {
      const fromSlot = activeRef.current;
      const toSlot = idle();
      const from = decksRef.current[fromSlot];
      const to = decksRef.current[toSlot];
      if (!to) return;

      if (from) {
        from.handedOver = true;
        from.retiring = true;
        // Logged now rather than at its `onend`: by this point the track has been
        // heard to within a crossfade of its end, and once it is retiring its
        // events are suppressed.
        logEnd(from);
      }

      activeRef.current = toSlot;
      to.retiring = false;
      to.howl.volume(0);
      if (!to.howl.playing()) to.howl.play();

      if (advance) usePlayer.getState().next(true);

      usePlayer.getState().setActiveStream(to.stream.quality, to.stream.steppedDown);
      usePlayer.getState().setProgress(0, to.howl.duration() || 0);
      startTicker();
      ramp(fromSlot, toSlot, seconds);
    }

    /** Buffer the next track on the idle deck, silent and paused. */
    function preloadNext() {
      // Never during a blend. The idle slot is holding the outgoing deck until the
      // ramp finishes with it, and loading over that entry would orphan the sound
      // there: nothing would hold a reference to stop it, so a track nobody can
      // see would keep playing underneath.
      if (rampRef.current !== null) return;

      const next = peekNext();
      if (!next) return;
      const existing = idleDeck();
      if (existing && existing.songId === next.id) return;
      if (preloadingRef.current === next.id) return;

      // A stale buffer for a track that is no longer next is worse than none.
      if (existing) destroyDeck(idle());

      preloadingRef.current = next.id;
      void buildDeck(idle(), next, { autoplay: false, startVolume: 0 }).finally(() => {
        if (preloadingRef.current === next.id) preloadingRef.current = null;
      });
    }

    /**
     * Report position on an interval rather than requestAnimationFrame. rAF is
     * suspended while a tab is backgrounded or the screen is locked, which would
     * freeze the progress bar and the OS scrubber even though audio keeps
     * playing. Timers keep firing, so the position stays truthful.
     */
    function startTicker() {
      stopTicker();
      tickRef.current = window.setInterval(() => {
        const deck = activeDeck();
        if (!deck || !deck.howl.playing()) return;
        const raw = deck.howl.seek();
        const time = typeof raw === 'number' ? raw : 0;
        const duration = deck.howl.duration() || 0;
        if (time > deck.maxProgress) deck.maxProgress = time;

        if (!deck.playLogged && time >= PLAY_THRESHOLD_SECONDS) {
          deck.playLogged = true;
          useHistory.getState().log(deck.song, 'play');
        }

        const { currentTime, crossfade } = usePlayer.getState();
        if (Math.abs(time - currentTime) >= 0.25) {
          usePlayer.getState().setProgress(time, duration);
        }

        if (duration > 0 && !deck.handedOver) {
          const remaining = duration - time;
          const blend = crossfade > 0 ? crossfade : GAPLESS_BLEND_SECONDS;

          // Buffer ahead of the blend, so the incoming side is ready to sound the
          // moment it is needed.
          if (remaining <= blend + PRELOAD_LEAD_SECONDS) preloadNext();

          if (remaining <= blend) {
            const incoming = idleDeck();
            const next = peekNext();
            if (incoming && next && incoming.songId === next.id && !incoming.retiring) {
              // Advancing lands on the track already sounding on the newly active
              // deck, so the subscription sees no change to react to.
              handOver(blend, true);
            }
          }
        }
      }, 250);
    }

    /** Replace whatever is playing with this track, with no buffer to blend into. */
    async function hardLoad(song: Song | null, opts: { sameTrack?: boolean } = {}) {
      cancelBlend();
      stopTicker();

      const previous = activeDeck();
      if (previous) {
        // A short fade rather than an instant stop: cutting a waveform mid-cycle
        // is audible as a click.
        const outgoingSlot = activeRef.current;
        previous.retiring = true;
        previous.howl.fade(previous.howl.volume(), 0, HARD_CUT_FADE_SECONDS * 1000);
        window.setTimeout(() => {
          if (decksRef.current[outgoingSlot] === previous) destroyDeck(outgoingSlot);
        }, HARD_CUT_FADE_SECONDS * 1000 + 40);
      }

      // Take the other slot so the outgoing fade is undisturbed.
      const slot = previous ? idle() : activeRef.current;
      if (decksRef.current[slot]) destroyDeck(slot);
      activeRef.current = slot;

      if (!song) {
        usePlayer.getState().setActiveStream(null, false);
        return;
      }

      usePlayer.getState().setLoading(true);
      const deck = await buildDeck(slot, song, { autoplay: true, startVolume: 1 });
      if (!deck) {
        // buildDeck reports its own failure through onloaderror; a null here with
        // no stream at all still needs the queue moved along.
        if (decksRef.current[slot] === null) {
          usePlayer.getState().setLoading(false);
          usePlayer.getState().setActiveStream(null, false);
          handleFailure();
        }
        return;
      }
      if (opts.sameTrack) {
        // A quality reload keeps the listening the track already earned, so the
        // 12-second threshold cannot log a second play for it.
        deck.playLogged = true;
      }
      startTicker();
    }

    const unsub = usePlayer.subscribe((state, prev) => {
      const track = state.currentTrack();
      const active = activeDeck();

      if (track?.id !== active?.songId) {
        // The handover already put this track on the active deck; nothing to do
        // but let it play.
        if (track && active && active.songId === track.id) return;

        const incoming = idleDeck();
        if (track && incoming && incoming.songId === track.id && !incoming.retiring) {
          // Buffered but not yet sounding, which is a skip into a preloaded
          // track. Blend it in, briefly, so the button still feels immediate.
          handOver(Math.min(state.crossfade || GAPLESS_BLEND_SECONDS, SKIP_BLEND_SECONDS), false);
          return;
        }
        void hardLoad(track);
        return;
      }

      if (state.quality !== prev.quality && track) {
        const raw = active?.howl.seek();
        resumeAtRef.current = typeof raw === 'number' ? raw : null;
        void hardLoad(track, { sameTrack: true });
        return;
      }

      if (!active) return;

      if (state.seekSeq !== prev.seekSeq) {
        // Seeking back into a track mid-blend would leave the old one fading over
        // it, so the blend is abandoned first.
        if (rampRef.current !== null) cancelBlend();
        active.howl.seek(state.currentTime);
        active.handedOver = false;
        if (state.isPlaying && !active.howl.playing()) active.howl.play();
        return;
      }

      if (state.isPlaying !== prev.isPlaying) {
        if (state.isPlaying) {
          if (!active.howl.playing()) active.howl.play();
        } else {
          // Pausing mid-blend keeps only the incoming track, otherwise resuming
          // would restart a fade from a position nobody can see.
          if (rampRef.current !== null) cancelBlend();
          if (active.howl.playing()) active.howl.pause();
        }
      }

      if (state.volume !== prev.volume || state.muted !== prev.muted) {
        Howler.volume(state.muted ? 0 : state.volume);
      }
    });

    const s = usePlayer.getState();
    Howler.volume(s.muted ? 0 : s.volume);
    const initial = s.currentTrack();
    if (initial) void hardLoad(initial);

    return () => {
      unsub();
      stopTicker();
      stopRamp();
      // Invalidate in-flight loads so they cannot create an orphaned sound after
      // teardown, then drop both decks.
      loadTicketRef.current = [
        loadTicketRef.current[0] + 1,
        loadTicketRef.current[1] + 1,
      ];
      destroyDeck(0);
      destroyDeck(1);
      activeRef.current = 0;
      preloadingRef.current = null;
    };
  }, []);

  return null;
}
