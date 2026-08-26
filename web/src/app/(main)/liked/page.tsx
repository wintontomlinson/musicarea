import type { Metadata } from 'next';
import { LikedSongsView } from '@/components/library/LikedSongsView';

export const metadata: Metadata = { title: 'Liked Songs', robots: { index: false } };

export default function LikedPage() {
  return <LikedSongsView />;
}
