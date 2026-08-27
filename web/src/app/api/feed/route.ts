import { NextResponse } from 'next/server';
import { api, ApiError } from '@/lib/api';
import type { HistoryEntry } from '@/lib/types';

/**
 * Proxy for the personalised feed.
 *
 * This exists because the feed's most important input, the listener's history, lives
 * in localStorage and is therefore only knowable in the browser. `lib/api.ts` is
 * server-only (the Flask base URL has no `NEXT_PUBLIC_` prefix and Flask sends no
 * CORS headers), so the client cannot call it directly and needs a same-origin
 * handler, exactly as the audio engine already uses `/api/song/[id]`.
 *
 * Before this existed the home page called the feed with `history: []` from the
 * server, which meant the recommender always ran in its cold-start path no matter how
 * much the listener had played.
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const payload = (body ?? {}) as {
    history?: unknown;
    languages?: unknown;
    limit?: unknown;
    mood?: unknown;
  };

  // Shapes are checked rather than trusted. This handler is publicly reachable, and
  // the upstream API is the one place a malformed payload could get expensive, so the
  // arrays are bounded here as well as there.
  const history: HistoryEntry[] = Array.isArray(payload.history)
    ? (payload.history.filter(
        (entry): entry is HistoryEntry =>
          !!entry && typeof entry === 'object' && typeof (entry as HistoryEntry).id === 'string',
      ) as HistoryEntry[]).slice(-400)
    : [];

  const languages = Array.isArray(payload.languages)
    ? payload.languages.filter((value): value is string => typeof value === 'string').slice(0, 8)
    : [];

  const limit =
    typeof payload.limit === 'number' && Number.isFinite(payload.limit)
      ? Math.min(40, Math.max(1, Math.trunc(payload.limit)))
      : undefined;

  const mood = typeof payload.mood === 'string' && payload.mood ? payload.mood : undefined;

  try {
    const data = await api.feed({
      history,
      languages: languages.length ? languages : ['hindi'],
      limit,
      mood,
    });
    return NextResponse.json(data);
  } catch (err) {
    const status = err instanceof ApiError && err.status === 503 ? 503 : 502;
    return NextResponse.json({ error: 'Could not build your feed' }, { status });
  }
}
