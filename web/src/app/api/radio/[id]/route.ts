import { NextResponse } from 'next/server';
import { api, ApiError } from '@/lib/api';

/**
 * Proxy for a station seeded from one track.
 *
 * Client-reachable because the station is started by a tap, and the seed is whatever
 * the listener happens to be playing. Fetching it on the server at render time would
 * mean building a station for a track nobody asked about.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'Missing song id' }, { status: 400 });

  try {
    const station = await api.radio(id);
    // A station with no tracks is a 404 upstream, but a successful response with an
    // empty list is still possible. Reporting that as an error is more useful to the
    // caller than handing back an empty station it would have to test for anyway.
    if (!station.items?.length) {
      return NextResponse.json({ error: 'No station available for this track' }, { status: 404 });
    }
    return NextResponse.json(station);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      return NextResponse.json({ error: 'No station available for this track' }, { status: 404 });
    }
    const status = err instanceof ApiError && err.status === 503 ? 503 : 502;
    return NextResponse.json({ error: 'Could not build a station' }, { status });
  }
}
