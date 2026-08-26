import { redirect } from 'next/navigation';

/**
 * Legacy path. Recently played now lives at /history, so keep the old URL
 * working instead of breaking links that already point at it.
 */
export default function RecentPage() {
  redirect('/history');
}
