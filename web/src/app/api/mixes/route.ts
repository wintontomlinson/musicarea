import { NextResponse } from 'next/server';
import { api, ApiError } from '@/lib/api';
import type { HistoryEntry } from '@/lib/types';

/**
 * Proxy for personalised mixes. Same reason as the feed handler: the history that
 * drives it only exists in the browser.
 *
 * This is the slowest endpoint in the API, since each mix runs its own recall pass
 * upstream. The section that calls it defers the request until it scrolls into view
 * rather than firing it on page load.
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const payload = (body ?? {}) as { history?: unknown; perMix?: unknown };

  const history: HistoryEntry[] = Array.isArray(payload.history)
    ? (payload.history.filter(
        (entry): entry is HistoryEntry =>
          !!entry && typeof entry === 'object' && typeof (entry as HistoryEntry).id === 'string',
      ) as HistoryEntry[]).slice(-400)
    : [];

  // With no history the upstream returns an empty cold-start result anyway, so the
  // round trip is skipped and the same shape is answered directly.
  if (history.length === 0) {
    return NextResponse.json({ mixes: [], meta: { coldStart: true, reason: 'no history' } });
  }

  const perMix =
    typeof payload.perMix === 'number' && Number.isFinite(payload.perMix)
      ? Math.min(40, Math.max(10, Math.trunc(payload.perMix)))
      : undefined;

  try {
    const data = await api.mixes({ history, perMix });
    return NextResponse.json(data);
  } catch (err) {
    const status = err instanceof ApiError && err.status === 503 ? 503 : 502;
    return NextResponse.json({ error: 'Could not build your mixes' }, { status });
  }
}
