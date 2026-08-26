import type { Metadata } from 'next';
import { HistoryView } from '@/components/library/HistoryView';

export const metadata: Metadata = { title: 'Recently Played', robots: { index: false } };

export default function HistoryPage() {
  return <HistoryView />;
}
