import type { Metadata } from 'next';
import { CollectionExperience } from '@/components/library/CollectionExperience';

export const metadata: Metadata = { title: 'Favourites', robots: { index: false } };

export default function LikedPage() {
  return (
    <CollectionExperience
      kind="Favourites"
      icon="heart"
      source="liked"
      intro="The music you have hearted, kept on this device. Nothing is uploaded and no account is needed."
    />
  );
}
