import type { Metadata } from 'next';
import { ComingSoon } from '@/components/ui/ComingSoon';

export const metadata: Metadata = { title: 'Liked Songs', robots: { index: false } };

export default function LikedPage() {
  return <ComingSoon page="Liked Songs" />;
}
