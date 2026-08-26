import type { Metadata } from 'next';
import { LibraryHub } from '@/components/library/LibraryHub';

export const metadata: Metadata = { title: 'Your Library', robots: { index: false } };

export default function LibraryPage() {
  return <LibraryHub />;
}
