import { NextResponse } from 'next/server';
import { api } from '@/lib/api';

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
  } catch {
    return NextResponse.json({ error: 'Search failed' }, { status: 502 });
  }
}
