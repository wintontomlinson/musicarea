'use client';

import { useEffect, useState } from 'react';
import { usePlayer } from '@/stores/player';
import { Drawer } from '@/components/ui/Drawer';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { artistLine } from '@/lib/utils';

type State =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; lines: string[]; copyright?: string | null }
  | { kind: 'none' }
  | { kind: 'error' };

/**
 * Lyrics panel.
 *
 * Fetched lazily: nothing is requested until the panel is opened, and the result
 * is cached per song id for the session so reopening is instant. The request is
 * aborted if the track changes mid-flight.
 *
 * The catalogue publishes lyrics as a plain block with no timing data, so this
 * renders static text. Synced scrolling is not offered because the source cannot
 * support it, and guessing timings would be fiction.
 */
export function LyricsPanel() {
  const open = usePlayer((s) => s.lyricsOpen);
  const setLyricsOpen = usePlayer((s) => s.setLyricsOpen);
  const track = usePlayer((s) => s.currentTrack());
  const [state, setState] = useState<State>({ kind: 'idle' });
  const [cache] = useState(() => new Map<string, State>());

  const songId = track?.id;

  useEffect(() => {
    if (!open || !songId) return;

    const cached = cache.get(songId);
    if (cached) {
      setState(cached);
      return;
    }

    const controller = new AbortController();
    setState({ kind: 'loading' });

    (async () => {
      try {
        const res = await fetch(`/api/lyrics/${encodeURIComponent(songId)}`, {
          signal: controller.signal,
        });
        if (res.status === 404) {
          const next: State = { kind: 'none' };
          cache.set(songId, next);
          setState(next);
          return;
        }
        if (!res.ok) {
          setState({ kind: 'error' });
          return;
        }
        const data = (await res.json()) as { lyrics?: string; copyright?: string | null };
        const lines = toLines(data.lyrics ?? '');
        const next: State = lines.length
          ? { kind: 'ready', lines, copyright: data.copyright }
          : { kind: 'none' };
        cache.set(songId, next);
        setState(next);
      } catch (error) {
        if ((error as Error).name === 'AbortError') return;
        setState({ kind: 'error' });
      }
    })();

    return () => controller.abort();
  }, [open, songId, cache]);

  return (
    <Drawer open={open} onClose={() => setLyricsOpen(false)} title="Lyrics">
      {!track ? (
        <EmptyState
          compact
          icon="lyrics"
          title="Nothing playing"
          message="Start a song to see its lyrics."
        />
      ) : (
        <div className="p-4">
          <div className="mb-5">
            <p className="truncate text-body font-semibold">{track.name}</p>
            <p className="mt-0.5 truncate t-meta">{artistLine(track)}</p>
          </div>

          {state.kind === 'loading' && (
            <div className="flex flex-col gap-3" aria-hidden="true">
              {Array.from({ length: 12 }).map((_, i) => (
                <Skeleton key={i} className="h-3.5" style={{ width: `${88 - (i % 4) * 14}%` }} />
              ))}
            </div>
          )}

          {state.kind === 'ready' && (
            <>
              <div className="flex flex-col gap-2.5 whitespace-pre-wrap text-body leading-relaxed text-text-secondary">
                {state.lines.map((line, index) =>
                  line ? <p key={index}>{line}</p> : <span key={index} className="h-2" />,
                )}
              </div>
              {state.copyright && (
                <p className="mt-7 border-t border-subtle pt-4 text-micro text-text-muted">
                  {state.copyright}
                </p>
              )}
            </>
          )}

          {state.kind === 'none' && (
            <EmptyState
              compact
              icon="lyrics"
              title="No lyrics for this track"
              message="The catalogue does not publish lyrics for this song."
            />
          )}

          {state.kind === 'error' && (
            <EmptyState
              compact
              icon="wifiOff"
              title="Could not load lyrics"
              message="Check your connection and try again."
              onRetry={() => {
                if (songId) cache.delete(songId);
                setState({ kind: 'loading' });
                // Re-run the effect by toggling the panel state off and on.
                setLyricsOpen(false);
                window.setTimeout(() => setLyricsOpen(true), 0);
              }}
            />
          )}
        </div>
      )}
    </Drawer>
  );
}

/**
 * The source returns one block with <br> separators and HTML entities. Split it
 * into lines and decode the handful of entities that actually appear, without
 * injecting the markup into the document.
 */
function toLines(raw: string): string[] {
  if (!raw) return [];
  return raw
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .split('\n')
    .map((line) => line.trim())
    .filter((line, index, all) => line.length > 0 || (index > 0 && all[index - 1].length > 0));
}
