import { NextResponse } from 'next/server';
import { api, ApiError } from '@/lib/api';
import { sanitiseHistory } from '@/lib/historyPayload';

/**
 * Generated mixes, built from the listening profile the browser sends.
 *
 * Requested separately from the feed because a cold build runs several recall
 * passes and takes seconds; folding it into the feed would hold up the whole
 * personalised section.
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const payload = (body ?? {}) as { history?: unknown; perMix?: unknown };
  const history = sanitiseHistory(payload.history);
  const perMix = typeof payload.perMix === 'number' ? payload.perMix : 24;

  try {
    const data = await api.mixes({ history, perMix });
    return NextResponse.json(data);
  } catch (err) {
    const status = err instanceof ApiError && (err.status === 429 || err.status === 503)
      ? err.status
      : 502;
    return NextResponse.json({ error: 'Could not build your mixes' }, { status });
  }
}
