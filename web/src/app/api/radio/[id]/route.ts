import { NextResponse } from 'next/server';
import { api, ApiError } from '@/lib/api';

/**
 * A station seeded from one track, used to extend the queue when it runs dry.
 *
 * Taste-ranked, unlike the catalogue's own `suggestions` endpoint: it scores the
 * same candidate pool the feed uses, caps repeats per artist and keeps the seed
 * itself out of the results.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const requested = Number(new URL(req.url).searchParams.get('limit'));
  // Flask clamps to 5..60 anyway; keeping the default here modest because this
  // is called mid-playback to top up a queue, not to fill a page.
  const limit = Number.isFinite(requested) ? requested : 30;

  try {
    const data = await api.radio(id, limit);
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      return NextResponse.json({ error: 'No station for that track' }, { status: 404 });
    }
    const status = err instanceof ApiError && (err.status === 429 || err.status === 503)
      ? err.status
      : 502;
    return NextResponse.json({ error: 'Could not build a station' }, { status });
  }
}
