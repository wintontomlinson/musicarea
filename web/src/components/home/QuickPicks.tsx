'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { Song } from '@/lib/types';
import { usePlayer } from '@/stores/player';
import { artistLine, entityHref, formatDuration, pickImage } from '@/lib/utils';
import { Icon } from '@/components/ui/Icon';
import { LikeButton } from '@/components/library/LikeButton';
import { ReasonPill } from '@/components/home/ReasonPill';

/** Rows per column. Four is YouTube Music's own choice and it is the right one: it
 *  fills a phone screen's width with a readable column without needing a second line
 *  of text per row. */
const ROWS = 4;

/**
 * Quick Picks: a horizontally paged grid of track rows.
 *
 * The structural idea, taken from YouTube Music, is that a horizontal row of *cards*
 * wastes most of its area on artwork, while a horizontal row of *columns of rows* fits
 * four times as many tracks in the same space and still leaves room for the artist
 * name. For a section whose job is "here are twenty things you could play right now",
 * density is the entire point.
 *
 * Each column snaps, so paging with a swipe lands cleanly instead of leaving a column
 * half cut off.
 */
export function QuickPicks({
  songs,
  title = 'Quick picks',
  subtitle,
}: {
  songs: Song[];
  title?: string;
  subtitle?: string;
}) {
  const playQueue = usePlayer((state) => state.playQueue);
  const currentId = usePlayer((state) => state.currentTrack()?.id);
  const isPlaying = usePlayer((state) => state.isPlaying);
  const toggle = usePlayer((state) => state.toggle);

  if (songs.length === 0) return null;

  const columns: Song[][] = [];
  for (let i = 0; i < songs.length; i += ROWS) columns.push(songs.slice(i, i + ROWS));

  return (
    <section aria-labelledby="quick-picks">
      <div className="mb-4 flex items-end gap-3">
        <div className="min-w-0">
          <p className="section-kicker mb-1">Straight into it</p>
          <h2 id="quick-picks" className="section-title truncate">
            {title}
          </h2>
          {subtitle && <p className="mt-1 truncate text-[13px] text-text-secondary">{subtitle}</p>}
        </div>
      </div>

      <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:-mx-8 sm:px-8 lg:-mx-10 lg:px-10">
        {columns.map((column, columnIndex) => (
          <div
            key={columnIndex}
            // Just under a full screen width on mobile, so the edge of the next column
            // is visible and the row is discoverably scrollable.
            className="w-[calc(100vw-3.5rem)] shrink-0 snap-start sm:w-[26rem] lg:w-[28rem]"
          >
            <ul className="flex flex-col gap-1">
              {column.map((song) => {
                const active = song.id === currentId;
                // Playing a pick queues the whole section from that point, not the one
                // track. Queueing a single song would strand the listener in silence
                // four minutes later, which is the thing this section exists to avoid.
                const startIndex = songs.findIndex((entry) => entry.id === song.id);
                return (
                  <li key={song.id}>
                    <div
                      className={`group flex items-center gap-3 rounded-card p-1.5 transition ${
                        active ? 'bg-accent/[0.1]' : 'hover:bg-white/[0.06]'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => (active ? toggle() : playQueue(songs, startIndex))}
                        aria-label={
                          active && isPlaying ? `Pause ${song.name}` : `Play ${song.name}`
                        }
                        className="relative h-12 w-12 shrink-0 overflow-hidden rounded-[9px] border border-white/10"
                      >
                        <Image
                          src={pickImage(song.image, '150x150')}
                          alt=""
                          fill
                          sizes="48px"
                          className="object-cover"
                        />
                        {/* The overlay is permanent for the active track and
                            hover-only otherwise, so the playing row is identifiable
                            without hovering it. */}
                        <span
                          className={`absolute inset-0 grid place-items-center bg-black/50 transition ${
                            active ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                          }`}
                        >
                          <Icon name={active && isPlaying ? 'pause' : 'play'} size={16} />
                        </span>
                      </button>

                      <div className="min-w-0 flex-1">
                        <Link
                          href={entityHref('song', song.name, song.id)}
                          className={`block truncate text-[13.5px] font-bold leading-tight hover:underline ${
                            active ? 'text-accent-soft' : ''
                          }`}
                        >
                          {song.name}
                        </Link>
                        <p className="mt-0.5 truncate text-[11.5px] leading-tight text-text-secondary">
                          {artistLine(song)}
                        </p>
                        <ReasonPill song={song} className="mt-1" />
                      </div>

                      <span className="hidden shrink-0 text-[11px] tabular-nums text-text-muted sm:block">
                        {formatDuration(song.duration ?? 0)}
                      </span>
                      <LikeButton
                        song={song}
                        size={16}
                        className="h-8 w-8 shrink-0 rounded-full opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100"
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
