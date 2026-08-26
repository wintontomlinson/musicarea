'use client';

import { useEffect, useRef, useState } from 'react';
import type { Song } from '@/lib/types';
import { usePlaylists } from '@/stores/playlists';
import { Icon } from '@/components/ui/Icon';

/**
 * "Add to playlist", as a small popover anchored to a track row.
 *
 * Lists the listener's playlists with the ones already holding this track marked
 * and disabled, so adding a duplicate is not offered rather than being silently
 * ignored. A name field at the bottom creates a new playlist seeded with the
 * track, which is the common case for the first one.
 */
export function AddToPlaylist({ song, className = '' }: { song: Song; className?: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const boxRef = useRef<HTMLDivElement>(null);

  const hydrate = usePlaylists((s) => s.hydrate);
  const playlists = usePlaylists((s) => s.playlists);
  const create = usePlaylists((s) => s.create);
  const addSong = usePlaylists((s) => s.addSong);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // Close on an outside click or Escape, like the search suggestion sheet.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function add(playlistId: string) {
    const result = addSong(playlistId, song);
    if (result === 'added') {
      setOpen(false);
      return;
    }
    setNote(result === 'full' ? 'That playlist is full.' : 'Already in that playlist.');
  }

  function createWith() {
    if (!name.trim()) return;
    create(name, [song]);
    setName('');
    setOpen(false);
  }

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        aria-label={`Add ${song.name} to a playlist`}
        aria-expanded={open}
        title="Add to playlist"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setNote('');
          setOpen((v) => !v);
        }}
        className={`grid place-items-center rounded-md text-text-muted transition-colors hover:text-white ${className}`}
      >
        <Icon name="playlistAdd" size={16} />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Add to playlist"
          className="glass-panel absolute right-0 z-50 mt-2 w-60 overflow-hidden rounded-xl2 border border-fuchsia-300/20 p-2 text-left shadow-glow"
        >
          <p className="px-2 pb-1.5 pt-1 text-[11px] font-bold uppercase tracking-[0.08em] text-text-muted">
            Add to playlist
          </p>

          {playlists.length > 0 && (
            <div className="max-h-52 overflow-y-auto">
              {playlists.map((p) => {
                const has = p.songs.some((s) => s.id === song.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={has}
                    onClick={() => add(p.id)}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[13px] transition-colors hover:bg-white/[0.08] disabled:cursor-default disabled:opacity-45 disabled:hover:bg-transparent"
                  >
                    <span className="min-w-0 flex-1 truncate">{p.name}</span>
                    {has ? (
                      <Icon name="check" size={14} className="shrink-0 text-accent-soft" />
                    ) : (
                      <span className="shrink-0 text-[11px] text-text-muted">{p.songs.length}</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          <div className="mt-1.5 border-t border-white/10 pt-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  createWith();
                }
              }}
              maxLength={60}
              placeholder="New playlist name"
              aria-label="New playlist name"
              className="w-full rounded-md border border-white/12 bg-black/25 px-2.5 py-1.5 text-[13px] outline-none transition placeholder:text-text-muted focus:border-fuchsia-300/60"
            />
            <button
              type="button"
              disabled={!name.trim()}
              onClick={createWith}
              className="mt-1.5 flex w-full items-center justify-center gap-1.5 rounded-md bg-brand px-2 py-1.5 text-[12px] font-bold text-white transition disabled:opacity-40"
            >
              <Icon name="plus" size={13} />
              Create and add
            </button>
          </div>

          {note && <p className="px-2 pt-2 text-[11px] text-amber-200/80">{note}</p>}
        </div>
      )}
    </div>
  );
}
