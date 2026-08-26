'use client';

import { useRouter } from 'next/navigation';
import { usePlayer } from '@/stores/player';
import { pickImage } from '@/lib/utils';
import { NowPlayingBackdrop, NowPlayingView } from './NowPlayingView';

/**
 * Route version of Now Playing. Same content as the overlay, laid out in the
 * page so the header and navigation stay available. Closing goes back rather
 * than dismissing a layer, because here it is a destination.
 */
export function NowPlayingRoute() {
  const router = useRouter();
  const track = usePlayer((s) => s.currentTrack());
  const cover = track ? pickImage(track.image) : null;

  return (
    <div className="relative min-h-[70vh] -mt-14 pt-14">
      {cover && <NowPlayingBackdrop cover={cover} />}
      <div className="relative">
        <NowPlayingView onClose={() => router.back()} />
      </div>
    </div>
  );
}
