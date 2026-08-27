import type { Metadata } from 'next';
import { ProfileExperience } from '@/components/profile/ProfileExperience';

/**
 * Noindex, like every other personal view. The content is derived entirely from
 * localStorage, so a crawler would only ever see the empty state, and indexing it
 * would put a permanently blank page in search results.
 */
export const metadata: Metadata = { title: 'Your listening', robots: { index: false } };

export default function ProfilePage() {
  return <ProfileExperience />;
}
