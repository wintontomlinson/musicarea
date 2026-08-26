import type { Metadata } from 'next';
import { NowPlayingRoute } from '@/components/player/NowPlayingRoute';

export const metadata: Metadata = {
  title: 'Now playing',
  robots: { index: false },
};

/**
 * Now Playing as a real route, so the screen can be linked, bookmarked and
 * reached with the back button rather than existing only as an overlay.
 */
export default function NowPlayingPage() {
  return <NowPlayingRoute />;
}
