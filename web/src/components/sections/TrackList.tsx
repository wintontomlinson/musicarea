'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { Song } from '@/lib/types';
import { usePlayer } from '@/stores/player';
import { artistLine, entityHref, formatDuration, pickImage, primaryArtist } from '@/lib/utils';
import { Icon } from '@/components/ui/Icon';
import { LikeButton } from '@/components/library/LikeButton';
import { AddToPlaylistButton } from '@/components/library/AddToPlaylistButton';

/**
 * Apple Music's track table: plain rows separated by hairlines that start past
 * the artwork, no surrounding box. Each row plays the whole list in context from
 * its position. The playing row turns red and shows animated equalizer bars in
 * place of its number; hovering swaps the number for a play glyph. `showArt`
 * toggles the cover thumbnail (albums hide it, playlists show it).
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
  const playNext = usePlayer((s) => s.playNext);

  if (!songs.length) return null;

  return (
    <div className="flex flex-col">
      {songs.map((song, i) => {
        const isCurrent = currentId === song.id;
        const artist = primaryArtist(song);
        return (
          <div
            key={`${song.id}-${i}`}
            className={`group grid grid-cols-[22px_1fr_auto] items-center gap-3 rounded-xl border border-transparent px-2 py-2.5 transition-colors sm:grid-cols-[22px_1.6fr_1fr_auto] ${
              isCurrent ? 'row-active' : 'hover:bg-white/[0.06]'
            }`}
          >
            {/* Index / equalizer / play */}
            <button
              type="button"
              aria-label={isCurrent && isPlaying ? `Pause ${song.name}` : `Play ${song.name}`}
              onClick={() => (isCurrent ? toggle() : playQueue(songs, i))}
              className="grid h-6 w-6 place-items-center text-[13px] tabular-nums text-text-secondary"
            >
              {isCurrent ? (
                isPlaying ? (
                  <Equalizer />
                ) : (
                  <Icon name="play" size={13} className="text-accent" />
                )
              ) : (
                <>
                  <span className="group-hover:hidden">{i + 1}</span>
                  <span className="hidden text-white group-hover:block">
                    <Icon name="play" size={13} />
                  </span>
                </>
              )}
            </button>

            {/* Title + artist (+ art) */}
            <div className="flex min-w-0 items-center gap-3">
              {showArt && (
                <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl border border-white/10">
                  <Image
                    src={pickImage(song.image, '150x150')}
                    alt=""
                    fill
                    sizes="44px"
                    className="object-cover"
                  />
                </span>
              )}
              <div className="min-w-0">
                <p
                  className={`truncate text-[14px] font-medium leading-tight ${
                    isCurrent ? 'text-accent' : ''
                  }`}
                >
                  {song.name}
                </p>
                <p className="mt-0.5 truncate text-[13px] leading-tight text-text-secondary">
                  {artist?.id ? (
                    <Link
                      href={entityHref('artist', artist.name, artist.id)}
                      className="hover:text-white"
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
                {/* `block` is required: truncate cannot clip an inline element,
                    so without it long album names overflow into the duration. */}
                {song.album?.id ? (
                  <Link
                    href={entityHref('album', song.album.name || '', song.album.id)}
                    className="block truncate text-[13px] text-text-secondary hover:text-white"
                  >
                    {song.album.name}
                  </Link>
                ) : (
                  <span className="block truncate text-[13px] text-text-secondary">
                    {song.album?.name}
                  </span>
                )}
              </div>
            )}

            {/* Row actions + duration. The actions stay visible once a track is
                favourited so the state is readable without hovering, and are
                always visible on touch, where there is no hover at all. */}
            <span className="flex items-center gap-1">
              <LikeButton
                song={song}
                size={15}
                className="h-7 w-7 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-focus-within:opacity-100 sm:group-hover:opacity-100 sm:aria-pressed:opacity-100"
              />
              {/* Queue and playlist are separate actions because they mean different things: the
                  queue is this listening session, a playlist is kept. Collapsing them into one
                  control would force a choice between the two. */}
              <button
                type="button"
                aria-label={`Play ${song.name} next`}
                title="Play next"
                onClick={() => playNext(song)}
                className="grid h-7 w-7 place-items-center rounded-md text-text-muted transition-colors hover:text-white sm:opacity-0 sm:transition-opacity sm:group-focus-within:opacity-100 sm:group-hover:opacity-100"
              >
                <Icon name="playNext" size={15} />
              </button>
              <AddToPlaylistButton
                song={song}
                size={15}
                className="h-7 w-7 text-text-muted sm:opacity-0 sm:transition-opacity sm:group-focus-within:opacity-100 sm:group-hover:opacity-100"
              />
              <span className="ml-1 text-[13px] tabular-nums text-text-secondary">
                {formatDuration(song.duration)}
              </span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Four animated bars. The parent swaps to a play glyph when paused, so this
 *  always animates while it is shown. */
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
