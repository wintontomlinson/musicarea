import { NextResponse } from 'next/server';
import { api, ApiError } from '@/lib/api';
import { sanitiseHistory } from '@/lib/historyPayload';
import { preferredLanguages } from '@/lib/languages';

/**
 * The personalised feed.
 *
 * This has to be a route handler rather than a server-component fetch, because
 * the recommender has no accounts and no database: it rebuilds the listening
 * profile from a log the browser holds. Server components cannot read
 * localStorage, which is why the home page previously posted an empty history
 * and the whole engine sat in cold start.
 *
 * Languages come from the cookie rather than the body, so the personalised rows
 * agree with the server-rendered shelves on the same page.
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const payload = (body ?? {}) as { history?: unknown; limit?: unknown; mood?: unknown };
  const history = sanitiseHistory(payload.history);
  const limit = typeof payload.limit === 'number' ? payload.limit : 24;
  const mood = typeof payload.mood === 'string' ? payload.mood : undefined;

  try {
    const data = await api.feed({
      history,
      languages: await preferredLanguages(),
      limit,
      ...(mood ? { mood } : {}),
    });
    return NextResponse.json(data);
  } catch (err) {
    // 429 is worth passing through unchanged: Flask rate-limits the recommender
    // endpoints and, because it keys on the socket address, every visitor shares
    // one bucket when the calls come from this server. The client backs off on it.
    const status = err instanceof ApiError && (err.status === 429 || err.status === 503)
      ? err.status
      : 502;
    return NextResponse.json({ error: 'Could not build your feed' }, { status });
  }
}
