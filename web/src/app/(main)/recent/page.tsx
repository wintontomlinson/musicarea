import type { Metadata } from 'next';
import { CollectionNotice } from '@/components/library/CollectionNotice';

export const metadata: Metadata = { title: 'Recent listening', robots: { index: false } };

export default function RecentPage() {
  return <CollectionNotice kind="Recent listening" icon="clock" detail="A simple record of your last plays belongs here. MusicArea does not persist listening history yet, so it does not fabricate a recent activity list." />;
}
