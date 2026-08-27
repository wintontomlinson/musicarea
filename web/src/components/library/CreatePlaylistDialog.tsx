'use client';

import { useRef, useState } from 'react';
import { usePlaylists } from '@/stores/playlists';
import { Sheet } from '@/components/ui/Sheet';
import { Icon } from '@/components/ui/Icon';

/**
 * Name-a-new-playlist dialog.
 *
 * Uses the shared `Sheet`, so it inherits the reference-counted scroll lock and the Escape stack
 * rather than reimplementing either. `placement="right"` gives it the scrim and the panel
 * treatment; a full takeover would be far too much chrome for a single text field.
 */
export function CreatePlaylistDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  /** Receives the new playlist's id, so the caller can navigate to it. */
  onCreated?: (id: string) => void;
}) {
  const create = usePlaylists((state) => state.create);
  const [name, setName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const id = create(name);
    if (!id) return;
    setName('');
    onClose();
    onCreated?.(id);
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      label="Create a playlist"
      placement="right"
      zClassName="z-[58]"
      className="glass-overlay flex h-full w-[min(92vw,26rem)] flex-col p-5"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-h4 font-extrabold">New playlist</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="grid h-9 w-9 place-items-center rounded-full text-text-secondary transition hover:bg-white/10 hover:text-white"
        >
          <Icon name="close" size={17} />
        </button>
      </div>

      <p className="mt-2 text-[13px] leading-relaxed text-text-secondary">
        Playlists you create are stored in this browser only. They are not uploaded and will not
        appear on your other devices.
      </p>

      <form onSubmit={submit} className="mt-5 flex flex-col gap-3">
        <label htmlFor="playlist-name" className="text-[12px] font-bold uppercase tracking-[0.1em] text-text-muted">
          Name
        </label>
        <input
          id="playlist-name"
          ref={inputRef}
          // Autofocus is appropriate here: the dialog exists for this one field, and it opens in
          // response to a deliberate tap.
          autoFocus
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={60}
          placeholder="Late night drive"
          className="w-full rounded-card border border-white/12 bg-black/25 px-4 py-3 text-[15px] font-semibold outline-none transition placeholder:text-text-muted focus:border-accent/60"
        />
        <div className="mt-2 flex items-center gap-2">
          <button type="submit" disabled={!name.trim()} className="button-primary disabled:cursor-not-allowed disabled:opacity-40">
            <Icon name="check" size={16} />
            Create
          </button>
          <button type="button" onClick={onClose} className="button-secondary">
            Cancel
          </button>
        </div>
      </form>
    </Sheet>
  );
}
