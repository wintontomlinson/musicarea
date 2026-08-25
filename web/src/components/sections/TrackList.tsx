'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { Song } from '@/lib/types';
import { usePlayer } from '@/stores/player';
import { artistLine, entityHref, formatDuration, pickImage, primaryArtist } from '@/lib/utils';
import { Icon } from '@/components/ui/Icon';

/**
 * A numbered track table. Each row plays the whole list in context from its
 * position. The currently playing row shows animated equalizer bars in place of
 * its number and is highlighted; hovering a row swaps the number for a play
 * icon. `showArt` toggles the cover thumbnail (albums hide it, playlists show).
 */
export function TrackList({
  songs,
  showArt = true,
  showAlbum = true,
}: {
  songs: Song[];
  showArt?: boolean;
  showAlbum?: boolean;
}) {
  const currentId = usePlayer((s) => s.currentTrack()?.id);
  const isPlaying = usePlayer((s) => s.isPlaying);
  const toggle = usePlayer((s) => s.toggle);
  const playQueue = usePlayer((s) => s.playQueue);

  if (!songs.length) return null;

  return (
    <div className="surface-card flex flex-col overflow-hidden p-1 shadow-lift">
      {songs.map((song, i) => {
        const isCurrent = currentId === song.id;
        const artist = primaryArtist(song);
        return (
          <div
            key={`${song.id}-${i}`}
            className={`group grid grid-cols-[24px_1fr_auto] items-center gap-3 rounded-lg px-2 py-2.5 sm:grid-cols-[24px_1.6fr_1fr_auto] ${
              isCurrent ? 'bg-accent/10' : 'hover:bg-white/5'
            }`}
          >
            {/* Index / equalizer / play */}
            <button
              type="button"
              aria-label={isCurrent && isPlaying ? `Pause ${song.name}` : `Play ${song.name}`}
              onClick={() => (isCurrent ? toggle() : playQueue(songs, i))}
              className="grid h-6 w-6 place-items-center text-sm tabular-nums text-text-secondary"
            >
              {isCurrent ? (
                isPlaying ? (
                  <Equalizer />
                ) : (
                  <Icon name="play" size={14} className="text-accent" />
                )
              ) : (
                <>
                  <span className="group-hover:hidden">{i + 1}</span>
                  <span className="hidden text-white group-hover:block">
                    <Icon name="play" size={14} />
                  </span>
                </>
              )}
            </button>

            {/* Title + artist (+ art) */}
            <div className="flex min-w-0 items-center gap-3">
              {showArt && (
                <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded">
                  <Image src={pickImage(song.image, '150x150')} alt="" fill sizes="40px" className="object-cover" />
                </span>
              )}
              <div className="min-w-0">
                <p className={`truncate text-sm font-semibold ${isCurrent ? 'text-accent' : ''}`}>
                  {song.name}
                </p>
                <p className="truncate text-xs text-text-secondary">
                  {artist?.id ? (
                    <Link
                      href={entityHref('artist', artist.name, artist.id)}
                      className="hover:text-white hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {artistLine(song)}
                    </Link>
                  ) : (
                    artistLine(song)
                  )}
                </p>
              </div>
            </div>

            {/* Album (desktop) */}
            {showAlbum && (
              <div className="hidden min-w-0 sm:block">
                {song.album?.id ? (
                  <Link
                    href={entityHref('album', song.album.name || '', song.album.id)}
                    className="truncate text-xs text-text-secondary hover:text-white hover:underline"
                  >
                    {song.album.name}
                  </Link>
                ) : (
                  <span className="truncate text-xs text-text-secondary">{song.album?.name}</span>
                )}
              </div>
            )}

            {/* Duration */}
            <span className="text-xs tabular-nums text-text-secondary">
              {formatDuration(song.duration)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Four animated bars. Frozen when the store reports paused (handled by parent
 *  swapping to a play icon), so this always animates while shown. */
function Equalizer() {
  return (
    <span className="flex h-3.5 items-end gap-0.5" aria-label="Now playing">
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          className="w-0.5 rounded-full bg-accent"
          style={{
            height: '100%',
            animation: `eqbar 900ms ease-in-out ${-i * 120}ms infinite`,
          }}
        />
      ))}
    </span>
  );
}
