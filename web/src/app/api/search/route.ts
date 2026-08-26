import { NextResponse } from 'next/server';
import { api } from '@/lib/api';

/**
 * Proxy for the combined search (autocomplete) used by the instant suggestions
 * dropdown and the "All" results tab. Keeps the Flask base URL server-side.
 */
export async function GET(req: Request) {
  const query = new URL(req.url).searchParams.get('q')?.trim();
  if (!query) return NextResponse.json({ error: 'Missing query' }, { status: 400 });
  try {
    const data = await api.searchAll(query);
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Search failed' }, { status: 502 });
  }
}
