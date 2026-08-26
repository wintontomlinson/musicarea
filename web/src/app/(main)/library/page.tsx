import type { Metadata } from 'next';
import { LibraryExperience } from '@/components/library/LibraryExperience';

export const metadata: Metadata = { title: 'Your Space', robots: { index: false } };

export default function LibraryPage() {
  return <LibraryExperience />;
}
