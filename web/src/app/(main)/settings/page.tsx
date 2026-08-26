import type { Metadata } from 'next';
import { SettingsExperience } from '@/components/settings/SettingsExperience';

export const metadata: Metadata = { title: 'Settings', robots: { index: false } };

export default function SettingsPage() {
  return <SettingsExperience />;
}
