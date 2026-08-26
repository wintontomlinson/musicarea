import { NextResponse } from 'next/server';
import { api, ApiError } from '@/lib/api';

/**
 * Proxy for the grouped search endpoint (top result, songs, albums, artists,
 * playlists). Runs on the server so the Flask base URL stays internal.
 */
export async function GET(req: Request) {
  const query = new URL(req.url).searchParams.get('q')?.trim();
  if (!query) return NextResponse.json({ error: 'Missing query' }, { status: 400 });
  try {
    const data = await api.searchAll(query);
    return NextResponse.json(data);
  } catch (err) {
    const status = err instanceof ApiError && err.status === 503 ? 503 : 502;
    return NextResponse.json({ error: 'Search failed' }, { status });
  }
}
