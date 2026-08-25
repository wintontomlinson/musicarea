import type { Metadata } from 'next';
import { ComingSoon } from '@/components/ui/ComingSoon';

export const metadata: Metadata = { title: 'Explore' };

export default function ExplorePage() {
  return <ComingSoon page="Explore" />;
}
