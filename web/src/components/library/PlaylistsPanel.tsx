'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePlaylists } from '@/stores/playlists';
import { usePlayer } from '@/stores/player';
import { FALLBACK_COVER, pickImage } from '@/lib/utils';
import { Icon } from '@/components/ui/Icon';

/**
 * `grid-cols-1` is load bearing here.
 *
 * Without an explicit column track, the implicit one is sized to max-content, and
 * a grid item's default `min-width: auto` means it will not shrink below that. A
 * long playlist name therefore pushed every card out to 511px and overflowed the
 * page at each phone width. Tailwind's column utilities resolve to
 * `minmax(0, 1fr)`, which can shrink, so naming the single-column case fixes it.
 */
const PLAYLIST_GRID = 'grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3';

/** The listener's playlists, with a way to start a new one. */
export function PlaylistsPanel() {
  const hydrate = usePlaylists((s) => s.hydrate);
  const hydrated = usePlaylists((s) => s.hydrated);
  const playlists = usePlaylists((s) => s.playlists);
  const create = usePlaylists((s) => s.create);
  const playQueue = usePlayer((s) => s.playQueue);
  const [name, setName] = useState('');

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  function submit() {
    if (!name.trim()) return;
    create(name);
    setName('');
  }

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="section-kicker mb-1">Built by you</p>
          <h2 className="section-title">Playlists</h2>
        </div>
        <div className="flex items-center gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                submit();
              }
            }}
            maxLength={60}
            placeholder="New playlist name"
            aria-label="New playlist name"
            className="w-44 rounded-xl border border-white/12 bg-black/25 px-3 py-2 text-[13px] outline-none transition placeholder:text-text-muted focus:border-fuchsia-300/60 sm:w-56"
          />
          <button
            type="button"
            disabled={!name.trim()}
            onClick={submit}
            className="button-primary disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Icon name="plus" size={15} />
            Create
          </button>
        </div>
      </div>

      {!hydrated ? (
        <p className="text-[13px] text-text-secondary">Checking this device…</p>
      ) : playlists.length === 0 ? (
        <div className="rounded-xl2 border border-dashed border-white/15 bg-white/[0.025] p-6 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-full border border-fuchsia-300/30 bg-fuchsia-400/10 text-accent-soft">
            <Icon name="playlistAdd" size={20} />
          </span>
          <h3 className="mt-3 text-[15px] font-extrabold">No playlists yet</h3>
          <p className="mx-auto mt-1.5 max-w-md text-[13px] leading-relaxed text-text-secondary">
            Name one above, or use the playlist button on any track to start one from that song.
          </p>
        </div>
      ) : (
        <div className={PLAYLIST_GRID}>
          {playlists.map((p) => {
            // A four-cover collage of the playlist's own contents says more than
            // a generic icon; it is what the playlist actually sounds like.
            const covers = p.songs.slice(0, 4).map((s) => pickImage(s.image, '150x150'));
            while (covers.length < 4) covers.push(FALLBACK_COVER);
            return (
              <div
                key={p.id}
                className="surface-card group flex items-center gap-3 p-3 transition hover:border-fuchsia-300/35 hover:shadow-glow"
              >
                <Link
                  href={`/library/playlist/${p.id}`}
                  className="flex min-w-0 flex-1 items-center gap-3"
                >
                  <span className="relative grid h-14 w-14 shrink-0 grid-cols-2 grid-rows-2 overflow-hidden rounded-xl border border-white/10">
                    {covers.map((src, i) => (
                      <span key={i} className="relative block overflow-hidden">
                        <Image src={src} alt="" fill sizes="28px" className="object-cover" />
                      </span>
                    ))}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[14px] font-bold">{p.name}</span>
                    <span className="mt-0.5 block text-[12px] text-text-secondary">
                      {p.songs.length} {p.songs.length === 1 ? 'track' : 'tracks'}
                    </span>
                  </span>
                </Link>
                <button
                  type="button"
                  aria-label={`Play ${p.name}`}
                  disabled={!p.songs.length}
                  onClick={() => playQueue(p.songs, 0)}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand text-white shadow-glow transition disabled:opacity-35"
                >
                  <Icon name="play" size={14} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
