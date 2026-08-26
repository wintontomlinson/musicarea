import type { Metadata } from 'next';
import { SavedCollectionsView } from '@/components/library/SavedCollectionsView';

export const metadata: Metadata = { title: 'Albums', robots: { index: false } };

export default function AlbumsPage() {
  return (
    <SavedCollectionsView
      type="album"
      title="Albums"
      emptyMessage="Open an album and use Save to keep it here."
    />
  );
}
