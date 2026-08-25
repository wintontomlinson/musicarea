import type { Metadata } from 'next';
import { ComingSoon } from '@/components/ui/ComingSoon';

export const metadata: Metadata = { title: 'Settings', robots: { index: false } };

export default function SettingsPage() {
  return <ComingSoon page="Settings" />;
}
