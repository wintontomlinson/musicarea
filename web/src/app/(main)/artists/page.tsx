import type { Metadata } from 'next';
import { SavedCollectionsView } from '@/components/library/SavedCollectionsView';

export const metadata: Metadata = { title: 'Artists', robots: { index: false } };

export default function ArtistsPage() {
  return (
    <SavedCollectionsView
      type="artist"
      title="Artists"
      emptyMessage="Open an artist and use Save to keep them here."
    />
  );
}
