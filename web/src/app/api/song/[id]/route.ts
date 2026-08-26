import { NextResponse } from 'next/server';
import { api } from '@/lib/api';

/**
 * Proxy for resolving a single song's full details (including stream URLs) from
 * Flask. Used by the audio engine when a queued track was stored without its
 * downloadUrl array. Runs on the server so the Flask base URL stays internal.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const songs = await api.song((await params).id);
    return NextResponse.json(songs);
  } catch {
    return NextResponse.json({ error: 'Song not found' }, { status: 404 });
  }
}
