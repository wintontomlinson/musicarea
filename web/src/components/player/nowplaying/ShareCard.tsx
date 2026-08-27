'use client';

import { useState } from 'react';
import type { Song } from '@/lib/types';
import { artistLine, pickImage } from '@/lib/utils';
import { usePalette, css } from '@/hooks/usePalette';
import { Icon } from '@/components/ui/Icon';
import { SITE } from '@/lib/config';

/**
 * Renders a shareable story card for the current track and hands it to the share sheet.
 *
 * 1080x1920 because that is the Instagram and WhatsApp story frame; anything else gets letterboxed
 * or cropped by the target app.
 *
 * Drawn on a canvas rather than screenshotting DOM. There is no reliable way to rasterise DOM in a
 * browser without a heavy library, and the output has to be an image file to be shareable at all.
 * Canvas also means the card is composed at full resolution rather than at whatever pixel density
 * the device happens to have.
 *
 * The artwork is routed through Next's image optimizer for the same reason `lib/color.ts` does it:
 * the CDN sends no CORS headers, and a canvas that has drawn an un-CORS-able cross-origin image
 * refuses to be exported. `/_next/image` is same-origin, so `toBlob` works.
 */

const WIDTH = 1080;
const HEIGHT = 1920;

/** Must be one of Next's configured image widths or the optimizer answers 400. */
const ART_WIDTH = 1080;

export function ShareCard({ song }: { song: Song }) {
  const palette = usePalette();
  const [state, setState] = useState<'idle' | 'working' | 'done' | 'error'>('idle');

  async function run() {
    if (state === 'working') return;
    setState('working');
    try {
      const blob = await draw(song, palette);
      if (!blob) throw new Error('render failed');
      const file = new File([blob], `${slugForFile(song.name)}.png`, { type: 'image/png' });

      // `canShare` with the file must be checked, not just `share`. Desktop Chrome has the Share API
      // but refuses file payloads, and calling it anyway throws.
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: song.name,
          text: `${song.name} by ${artistLine(song)}`,
        });
        setState('idle');
        return;
      }

      // No file sharing, so the card is downloaded instead. That still gets it into a story, just
      // with one more step.
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = file.name;
      link.click();
      URL.revokeObjectURL(url);
      setState('done');
      window.setTimeout(() => setState('idle'), 2200);
    } catch (err) {
      // A dismissed share sheet rejects with AbortError, which is not a failure.
      if (err instanceof Error && err.name === 'AbortError') {
        setState('idle');
        return;
      }
      setState('error');
      window.setTimeout(() => setState('idle'), 2600);
    }
  }

  return (
    <button
      type="button"
      onClick={run}
      aria-label="Create a shareable card"
      title="Share as an image"
      className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-white/75 transition hover:bg-white/10 hover:text-white"
    >
      {state === 'working' ? (
        <span
          className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
          aria-hidden="true"
        />
      ) : (
        <Icon name={state === 'done' ? 'check' : state === 'error' ? 'close' : 'samples'} size={20} />
      )}
    </button>
  );
}

async function draw(song: Song, palette: ReturnType<typeof usePalette>): Promise<Blob | null> {
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Background: the same vertical wash the app uses, built from the live palette so the card matches
  // whatever the artwork has made the app look like.
  const backdrop = ctx.createLinearGradient(0, 0, WIDTH * 0.4, HEIGHT);
  backdrop.addColorStop(0, css(palette.accent, 0.55));
  backdrop.addColorStop(0.45, css(palette.accentMid, 0.35));
  backdrop.addColorStop(1, css(palette.scrim));
  ctx.fillStyle = css(palette.scrim);
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = backdrop;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const art = await loadArt(pickImage(song.image));
  const size = 760;
  const artX = (WIDTH - size) / 2;
  const artY = 420;

  if (art) {
    // A soft accent glow behind the artwork, so it sits in the card rather than on it.
    ctx.save();
    ctx.shadowColor = css(palette.accent, 0.6);
    ctx.shadowBlur = 120;
    ctx.shadowOffsetY = 40;
    roundedRect(ctx, artX, artY, size, size, 44);
    ctx.fillStyle = css(palette.surface);
    ctx.fill();
    ctx.restore();

    ctx.save();
    roundedRect(ctx, artX, artY, size, size, 44);
    ctx.clip();
    // `drawImage` with an explicit box, because the source is square but a non-square cover would
    // otherwise be stretched.
    const scale = Math.max(size / art.width, size / art.height);
    const drawWidth = art.width * scale;
    const drawHeight = art.height * scale;
    ctx.drawImage(
      art,
      artX + (size - drawWidth) / 2,
      artY + (size - drawHeight) / 2,
      drawWidth,
      drawHeight,
    );
    ctx.restore();
  }

  ctx.textAlign = 'center';

  // Title. Wrapped by measurement rather than by a character count, because a character count is
  // meaningless across Devanagari, Latin and Tamil, which this catalogue mixes freely.
  ctx.fillStyle = css(palette.text);
  ctx.font = '700 78px Inter, system-ui, sans-serif';
  const titleLines = wrap(ctx, song.name, WIDTH - 200, 3);
  let y = artY + size + 150;
  for (const line of titleLines) {
    ctx.fillText(line, WIDTH / 2, y);
    y += 96;
  }

  ctx.fillStyle = css(palette.accentSoft);
  ctx.font = '600 46px Inter, system-ui, sans-serif';
  for (const line of wrap(ctx, artistLine(song), WIDTH - 220, 2)) {
    ctx.fillText(line, WIDTH / 2, y + 20);
    y += 60;
  }

  // Footer wordmark, so a reshared card still says where it came from.
  ctx.fillStyle = css(palette.textSecondary);
  ctx.font = '700 34px Inter, system-ui, sans-serif';
  ctx.fillText(SITE.name.toUpperCase(), WIDTH / 2, HEIGHT - 120);

  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), 'image/png'));
}

/**
 * Load the cover through the image optimizer so the canvas stays exportable.
 *
 * Resolves to null rather than rejecting: a card with a gradient and the track name is still worth
 * sharing, so a failed image must not fail the whole render.
 */
function loadArt(cover: string): Promise<HTMLImageElement | null> {
  if (!cover || cover.startsWith('data:')) return Promise.resolve(null);
  const src = cover.startsWith('/_next/image')
    ? cover
    : `/_next/image?url=${encodeURIComponent(cover)}&w=${ART_WIDTH}&q=90`;

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const timer = window.setTimeout(() => resolve(null), 6000);
    img.onload = () => {
      window.clearTimeout(timer);
      resolve(img);
    };
    img.onerror = () => {
      window.clearTimeout(timer);
      resolve(null);
    };
    img.src = src;
  });
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

/** Greedy word wrap by measured width, capped so a very long title cannot run off the card. */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth || !line) {
      line = candidate;
    } else {
      lines.push(line);
      line = word;
      if (lines.length === maxLines) break;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);

  // The last line is ellipsised if there is more text than fits, rather than silently truncated.
  if (lines.length === maxLines) {
    const consumed = lines.join(' ').split(/\s+/).length;
    if (consumed < words.length) {
      let last = lines[maxLines - 1];
      while (last && ctx.measureText(`${last}…`).width > maxWidth) {
        last = last.slice(0, -1);
      }
      lines[maxLines - 1] = `${last}…`;
    }
  }
  return lines;
}

function slugForFile(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'musicarea'
  );
}
