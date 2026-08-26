import { NextResponse } from 'next/server';
import { api } from '@/lib/api';

/**
 * Follow-on tracks for a song, used to extend the queue when autoplay is on.
 * Proxied so the Flask base URL stays server-side.
 */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const id = params.id?.trim();
  if (!id) return NextResponse.json({ error: 'Missing song id' }, { status: 400 });

  const requested = Number(new URL(req.url).searchParams.get('limit') ?? 12);
  const limit = Number.isFinite(requested) ? Math.min(Math.max(requested, 1), 20) : 12;

  try {
    return NextResponse.json(await api.suggestions(id, limit));
  } catch {
    return NextResponse.json({ error: 'No suggestions available' }, { status: 502 });
  }
}
