import { NextResponse } from 'next/server';
import { api, ApiError } from '@/lib/api';

/**
 * Lyrics for a track.
 *
 * A 404 from upstream means the catalogue simply has none for this song, which
 * is common and not an error. It is passed through as a 404 with an explicit
 * flag so the player can say "no lyrics" rather than "something went wrong".
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const data = await api.lyrics(id);
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      return NextResponse.json({ unavailable: true }, { status: 404 });
    }
    const status = err instanceof ApiError && err.status === 503 ? 503 : 502;
    return NextResponse.json({ error: 'Could not load lyrics' }, { status });
  }
}
