import type { Metadata } from 'next';
import { LocalPlaylistExperience } from '@/components/library/LocalPlaylistExperience';

/**
 * A locally created playlist.
 *
 * Nested under `/library` rather than sharing `/playlist/[id]` with catalogue playlists, because
 * the two are different things that happen to share a word. A catalogue playlist has an id the
 * API can resolve; a local one exists only in this browser's storage, and routing it through the
 * catalogue path would mean every local id producing a 404 from upstream.
 *
 * Noindex: there is nothing here for a crawler, which has no localStorage and would only ever see
 * the not-found state.
 */
export const metadata: Metadata = { title: 'Playlist', robots: { index: false } };

export default async function LocalPlaylistPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <LocalPlaylistExperience id={id} />;
}
