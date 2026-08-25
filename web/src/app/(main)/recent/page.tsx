import type { Metadata } from 'next';
import { ComingSoon } from '@/components/ui/ComingSoon';

export const metadata: Metadata = { title: 'Recently Played', robots: { index: false } };

export default function RecentPage() {
  return <ComingSoon page="Recently Played" />;
}
