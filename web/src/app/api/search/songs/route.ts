import { NextResponse } from 'next/server';
import { api, ApiError } from '@/lib/api';

/**
 * Proxy for full song search results (with stream URLs), used by the Songs tab
 * so results are directly playable.
 */
export async function GET(req: Request) {
  const query = new URL(req.url).searchParams.get('q')?.trim();
  if (!query) return NextResponse.json({ error: 'Missing query' }, { status: 400 });
  try {
    const data = await api.searchSongs(query, 30);
    return NextResponse.json(data);
  } catch (err) {
    // Distinguish "the catalogue is unreachable" from "the catalogue said no",
    // so the client can tell the listener something specific instead of
    // reporting every failure as an empty result set.
    const status = err instanceof ApiError && err.status === 503 ? 503 : 502;
    return NextResponse.json({ error: 'Search failed' }, { status });
  }
}
