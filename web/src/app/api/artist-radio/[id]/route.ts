import { NextResponse } from 'next/server';
import { api, ApiError } from '@/lib/api';

/**
 * A station seeded from an artist.
 *
 * Fetched on demand rather than prefetched with the artist page: artist routes
 * share Flask's 35-per-minute bucket with the recommender, so building a station
 * for every page view would spend that budget on visitors who never pressed play.
 *
 * Unlike song radio this response carries no `seed`, since the seed is the artist
 * rather than a track.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const requested = Number(new URL(req.url).searchParams.get('limit'));
  const limit = Number.isFinite(requested) ? requested : 40;

  try {
    const data = await api.artistRadio(id, limit);
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      return NextResponse.json({ error: 'No station for that artist' }, { status: 404 });
    }
    const status =
      err instanceof ApiError && (err.status === 429 || err.status === 503) ? err.status : 502;
    return NextResponse.json({ error: 'Could not build a station' }, { status });
  }
}
