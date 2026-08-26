import type { Metadata } from 'next';
import { PlaylistsView } from '@/components/playlists/PlaylistsView';

export const metadata: Metadata = { title: 'Playlists', robots: { index: false } };

export default function PlaylistsPage() {
  return <PlaylistsView />;
}
