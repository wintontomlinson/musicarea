import type { Metadata } from 'next';
import { CollectionExperience } from '@/components/library/CollectionExperience';

export const metadata: Metadata = { title: 'Recent listening', robots: { index: false } };

export default function RecentPage() {
  return (
    <CollectionExperience
      kind="Recent listening"
      icon="clock"
      source="recent"
      intro="The last tracks you played, newest first, kept on this device. Clearing it does not affect your favourites."
    />
  );
}
