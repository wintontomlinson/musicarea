import type { Metadata } from 'next';
import { CollectionNotice } from '@/components/library/CollectionNotice';

export const metadata: Metadata = { title: 'Favourites', robots: { index: false } };

export default function LikedPage() {
  return <CollectionNotice kind="Favourites" icon="heart" detail="A clean place for the music you love. Saving favourites is not connected yet, so this screen stays honest about what is available." />;
}
