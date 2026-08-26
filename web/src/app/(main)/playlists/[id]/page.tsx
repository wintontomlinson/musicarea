import type { Metadata } from 'next';
import { PlaylistDetailView } from '@/components/playlists/PlaylistDetailView';

export const metadata: Metadata = { title: 'Playlist', robots: { index: false } };

/**
 * A playlist stored in the browser. Rendered on the client because the data
 * never reaches the server, and excluded from indexing for the same reason.
 */
export default function LocalPlaylistPage({ params }: { params: { id: string } }) {
  return <PlaylistDetailView id={params.id} />;
}
