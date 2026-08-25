import type { Metadata } from 'next';
import { ComingSoon } from '@/components/ui/ComingSoon';

export const metadata: Metadata = { title: 'Your Library', robots: { index: false } };

export default function LibraryPage() {
  return <ComingSoon page="Your Library" />;
}
