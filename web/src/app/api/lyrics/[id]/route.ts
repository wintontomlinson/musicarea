import { NextResponse } from 'next/server';
import { api, ApiError } from '@/lib/api';

/**
 * Lyrics proxy. Keeps the Flask base URL server-side and preserves the upstream
 * 404, so the panel can tell "no lyrics for this track" apart from "the request
 * failed" instead of showing one vague message for both.
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const id = params.id?.trim();
  if (!id) return NextResponse.json({ error: 'Missing song id' }, { status: 400 });

  try {
    const data = await api.lyrics(id);
    return NextResponse.json(data);
  } catch (error) {
    const status = error instanceof ApiError && error.status === 404 ? 404 : 502;
    return NextResponse.json(
      { error: status === 404 ? 'No lyrics available' : 'Could not load lyrics' },
      { status },
    );
  }
}
