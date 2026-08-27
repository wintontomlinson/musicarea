'use client';

import { useState } from 'react';
import Image from 'next/image';
import { AnimatePresence, m } from 'motion/react';
import type { Song } from '@/lib/types';
import { pickImage } from '@/lib/utils';
import { usePlayer } from '@/stores/player';
import { trackSwap } from '@/lib/motion';

/**
 * The album artwork, presented as the hero of the screen.
 *
 * Three layers, and the reason for each:
 *
 * **The backdrop** is the same artwork blown up, heavily blurred and slowly drifting. This is
 * the Apple Music effect, and blurring the real cover rather than painting a gradient from its
 * colours is what makes the light behind the art feel like it belongs to the record: the
 * blurred image keeps the artwork's own distribution of colour, which a two-stop gradient
 * cannot.
 *
 * **The gradient wash** sits over it, tinted from the extracted palette, and exists to hold
 * contrast. Some sleeves are near-white, and the controls have to stay legible over those.
 *
 * **The artwork itself** floats, scaling and rising by around one percent over nine seconds.
 * Deliberately barely perceptible. The point is that the screen feels alive while the music
 * plays rather than that anyone watches it move; anything larger competes with the music.
 *
 * The float animation stops when playback pauses, which turns the motion into a status
 * indicator: the screen is still while the music is.
 */
export function ArtStage({ song }: { song: Song }) {
  const isPlaying = usePlayer((state) => state.isPlaying);
  const orderPos = usePlayer((state) => state.orderPos);
  const cover = pickImage(song.image);

  /**
   * Which way through the queue the listener just moved, so the artwork slides toward the side
   * they went: forward pushes the outgoing cover left, back pushes it right. That is the cue
   * that says which direction you travelled without anything needing to be read.
   *
   * Implemented with the adjust-state-during-render pattern rather than a ref or an effect.
   * A ref cannot be *read* during render to decide what to render, and an effect would set
   * state after paint, so the first frame of the swap would use the previous direction and the
   * animation would start the wrong way. Setting state during render is React's documented
   * answer for state derived from changing inputs: it re-renders immediately, before anything
   * is painted, so the correct direction is used from the first frame.
   */
  const [seen, setSeen] = useState(orderPos);
  const [direction, setDirection] = useState<1 | -1>(1);
  if (seen !== orderPos) {
    setSeen(orderPos);
    setDirection(orderPos > seen ? 1 : -1);
  }

  return (
    <div className="relative flex w-full items-center justify-center">
      <AnimatePresence mode="popLayout" initial={false}>
        <m.div
          // Keyed on the track *and* its queue position, because the same song can legitimately
          // sit in a queue twice and moving between those entries should still animate.
          key={`${song.id}-${orderPos}`}
          variants={trackSwap(direction)}
          initial="hidden"
          animate="show"
          exit="exit"
          className="relative w-full max-w-[min(78vw,26rem)] lg:max-w-[30rem]"
        >
          <div
            className={`relative aspect-square w-full overflow-hidden rounded-xl2 border border-white/[0.18] shadow-art ${
              isPlaying ? 'animate-float' : ''
            }`}
          >
            <Image
              src={cover}
              alt={`Artwork for ${song.name}`}
              fill
              priority
              sizes="(max-width: 1024px) 78vw, 480px"
              className="object-cover"
            />
          </div>
        </m.div>
      </AnimatePresence>
    </div>
  );
}

/**
 * The ambient backdrop, rendered separately so it can sit behind the whole sheet rather than
 * only behind the artwork column.
 *
 * Passed to `Sheet` as its `backdrop`, which keeps it outside the drag-transformed surface: a
 * background that moved with a dismiss gesture would break the illusion that it is light in
 * the room rather than part of the sheet.
 */
export function ArtBackdrop({ song }: { song: Song }) {
  const cover = pickImage(song.image);
  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
      <Image
        src={cover}
        alt=""
        fill
        priority
        sizes="100vw"
        // `animate-drift` slowly pans and rotates the blurred layer. At this blur radius the
        // movement is invisible as movement and reads only as shifting light.
        className="animate-drift object-cover opacity-40 blur-3xl"
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgb(var(--accent-rgb)/.34),transparent_38%),radial-gradient(circle_at_88%_4%,rgb(var(--accent-alt-rgb)/.24),transparent_36%),linear-gradient(to_bottom,rgb(var(--scrim-rgb)/.45),rgb(var(--scrim-rgb)/.9)_60%,rgb(var(--scrim-rgb)/.97))]" />
    </div>
  );
}
