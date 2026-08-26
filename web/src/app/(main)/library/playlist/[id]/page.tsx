import type { Metadata } from 'next';
import { PlaylistExperience } from '@/components/library/PlaylistExperience';

/**
 * A playlist the listener made, which exists only in their browser. Nested under
 * `/library` rather than sharing `/playlist/[id]` with the catalogue: those ids
 * come from upstream and a local id could otherwise collide with one. The whole
 * `/library` tree is already disallowed in robots.txt, which is right for
 * something no crawler can ever see.
 */
export const metadata: Metadata = { title: 'Your playlist', robots: { index: false } };

export default async function UserPlaylistPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PlaylistExperience id={id} />;
}
