'use client';

import { useState } from 'react';
import { usePlayer } from '@/stores/player';
import { Icon } from '@/components/ui/Icon';
import type { RadioSet } from '@/lib/types';

/**
 * Starts an endless station from a track or an artist.
 *
 * Fetched on click, not on render. A station is several recall passes on the
 * server and shares a small rate-limit budget, so building one for every visitor
 * who merely opened the page would be wasteful and would crowd out the feed.
 *
 * Autoplay then keeps the station going: once the queue nears its end it extends
 * from whatever is playing, so this is a starting point rather than a fixed list.
 */
export function StationButton({
  kind,
  id,
  label = 'Start station',
  className = 'button-secondary',
}: {
  kind: 'song' | 'artist';
  id: string;
  label?: string;
  className?: string;
}) {
  const playQueue = usePlayer((s) => s.playQueue);
  const [state, setState] = useState<'idle' | 'loading' | 'empty' | 'error'>('idle');

  async function start() {
    setState('loading');
    try {
      const path = kind === 'song' ? `/api/radio/${encodeURIComponent(id)}` : `/api/artist-radio/${encodeURIComponent(id)}`;
      const res = await fetch(path);
      if (!res.ok) {
        // 429 is the one worth naming: it is temporary and self-resolving.
        setState(res.status === 429 ? 'error' : res.status === 404 ? 'empty' : 'error');
        return;
      }
      const data = (await res.json()) as RadioSet;
      if (!data.items?.length) {
        setState('empty');
        return;
      }
      playQueue(data.items, 0);
      setState('idle');
    } catch {
      setState('error');
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button type="button" onClick={start} disabled={state === 'loading'} className={className}>
        {state === 'loading' ? (
          <span
            className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white"
            aria-hidden="true"
          />
        ) : (
          <Icon name="radio" size={15} />
        )}
        {state === 'loading' ? 'Building…' : label}
      </button>
      {state === 'empty' && (
        <span className="text-[12px] text-text-secondary">No station for this one.</span>
      )}
      {state === 'error' && (
        <span className="text-[12px] text-text-secondary">Could not build it. Try again.</span>
      )}
    </span>
  );
}
