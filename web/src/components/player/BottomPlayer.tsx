'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePlayer } from '@/stores/player';
import { artistLine, entityHref, pickImage, primaryArtist } from '@/lib/utils';
import { Icon } from '@/components/ui/Icon';
import { TransportControls } from './PlayerControls';
import { VolumeControl } from './VolumeControl';
import { SeekBar } from './SeekBar';
import { FavoriteButton } from '@/components/library/FavoriteButton';

/**
 * The persistent desktop player.
 *
 * Three zones: what is playing on the left, transport and seek in the centre,
 * and secondary tools on the right. It is mounted once in the app shell, so it
 * survives navigation and never restarts audio.
 *
 * When nothing is queued the bar still renders, with controls disabled, so the
 * window does not change height the moment playback starts.
 */
export function BottomPlayer() {
  const track = usePlayer((s) => s.currentTrack());
  const setFullscreen = usePlayer((s) => s.setFullscreen);
  const queueOpen = usePlayer((s) => s.queueOpen);
  const setQueueOpen = usePlayer((s) => s.setQueueOpen);
  const lyricsOpen = usePlayer((s) => s.lyricsOpen);
  const setLyricsOpen = usePlayer((s) => s.setLyricsOpen);

  const cover = track ? pickImage(track.image, '150x150') : null;
  const artist = track ? primaryArtist(track) : undefined;

  return (
    <div
      aria-label="Player"
      className="fixed inset-x-0 bottom-0 z-40 hidden h-player border-t border-subtle bg-bg-alt lg:block"
    >
      <div className="mx-auto grid h-full max-w-[1560px] grid-cols-[minmax(180px,1fr)_minmax(0,2fr)_minmax(180px,1fr)] items-center gap-4 px-4 xl:px-6">
        {/* Now playing */}
        <div className="flex min-w-0 items-center gap-3">
          {track && cover ? (
            <>
              <button
                type="button"
                onClick={() => setFullscreen(true)}
                aria-label="Open full screen player"
                className="group relative h-12 w-12 shrink-0 overflow-hidden rounded-sm bg-surface-raised"
              >
                <Image src={cover} alt="" fill sizes="48px" className="object-cover" />
                <span className="absolute inset-0 grid place-items-center bg-black/45 opacity-0 transition-opacity duration-fast group-hover:opacity-100">
                  <Icon name="chevronUp" size={18} />
                </span>
              </button>

              <div className="min-w-0">
                <Link
                  href={entityHref('song', track.name, track.id)}
                  className="block truncate text-meta font-semibold transition-colors duration-fast hover:underline"
                >
                  {track.name}
                </Link>
                {artist?.id ? (
                  <Link
                    href={entityHref('artist', artist.name, artist.id)}
                    className="block truncate text-micro text-text-secondary transition-colors duration-fast hover:text-text hover:underline"
                  >
                    {artistLine(track)}
                  </Link>
                ) : (
                  <p className="truncate text-micro text-text-secondary">{artistLine(track)}</p>
                )}
              </div>

              <FavoriteButton song={track} size={17} className="ml-1 h-8 w-8" />
            </>
          ) : (
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-sm border border-subtle bg-white/5 text-text-muted">
                <Icon name="disc" size={20} />
              </div>
              <p className="truncate text-meta text-text-muted">Nothing playing</p>
            </div>
          )}
        </div>

        {/* Transport + seek */}
        <div className="flex flex-col items-center gap-0.5">
          <TransportControls size="bar" />
          <div className="w-full max-w-[560px]">
            <SeekBar showTimes />
          </div>
        </div>

        {/* Secondary tools */}
        <div className="flex items-center justify-end gap-0.5">
          <button
            type="button"
            aria-label="Lyrics"
            aria-pressed={lyricsOpen}
            onClick={() => setLyricsOpen(!lyricsOpen)}
            className={lyricsOpen ? 'btn-icon bg-white/10 text-accent' : 'btn-icon'}
          >
            <Icon name="lyrics" size={17} />
          </button>

          <button
            type="button"
            aria-label="Queue"
            aria-pressed={queueOpen}
            onClick={() => setQueueOpen(!queueOpen)}
            className={queueOpen ? 'btn-icon bg-white/10 text-accent' : 'btn-icon'}
          >
            <Icon name="queue" size={17} />
          </button>

          <div className="hidden xl:block">
            <VolumeControl />
          </div>

          <button
            type="button"
            aria-label="Open full screen player"
            onClick={() => setFullscreen(true)}
            className="btn-icon"
          >
            <Icon name="expand" size={17} />
          </button>
        </div>
      </div>
    </div>
  );
}
