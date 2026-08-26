'use client';

import { useEffect, useState } from 'react';
import type { Lyrics as LyricsData } from '@/lib/types';

type State =
  | { status: 'loading' }
  | { status: 'ready'; lyrics: string; copyright?: string | null }
  /** The catalogue has none for this track. Common, and not a failure. */
  | { status: 'none' }
  | { status: 'error' };

/**
 * Lyrics for the current track.
 *
 * The API returns them as a single string with `<br>` separators rather than an
 * array of lines, and it answers 404 when it has none, which is common enough
 * that it is treated as an outcome rather than an error. The text is split and
 * rendered as elements instead of being injected as HTML, since it is third-party
 * content and there is no reason to trust it as markup.
 */
export function Lyrics({ songId }: { songId: string }) {
  const [state, setState] = useState<{ id: string; value: State } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch(`/api/lyrics/${encodeURIComponent(songId)}`, {
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        if (res.status === 404) {
          setState({ id: songId, value: { status: 'none' } });
          return;
        }
        if (!res.ok) {
          setState({ id: songId, value: { status: 'error' } });
          return;
        }
        const data = (await res.json()) as LyricsData;
        if (controller.signal.aborted) return;
        setState({
          id: songId,
          value: data.lyrics
            ? { status: 'ready', lyrics: data.lyrics, copyright: data.copyright }
            : { status: 'none' },
        });
      } catch {
        if (!controller.signal.aborted) setState({ id: songId, value: { status: 'error' } });
      }
    })();
    return () => controller.abort();
  }, [songId]);

  const current: State = state?.id === songId ? state.value : { status: 'loading' };

  if (current.status === 'loading') {
    return <p className="text-[13px] text-white/50">Looking for lyrics…</p>;
  }
  if (current.status === 'none') {
    return <p className="text-[13px] text-white/50">No lyrics for this track.</p>;
  }
  if (current.status === 'error') {
    return <p className="text-[13px] text-white/50">Lyrics could not be loaded.</p>;
  }

  const lines = current.lyrics
    .split(/<br\s*\/?>|\n/i)
    .map((line) => line.trim())
    .filter((line, i, all) => line || (i > 0 && all[i - 1]));

  return (
    <div>
      <div className="flex flex-col gap-1.5 text-[15px] leading-relaxed text-white/85">
        {lines.map((line, i) =>
          line ? <p key={i}>{line}</p> : <span key={i} className="h-2" aria-hidden="true" />,
        )}
      </div>
      {current.copyright && (
        <p className="mt-5 text-[11px] leading-relaxed text-white/35">{current.copyright}</p>
      )}
    </div>
  );
}
