'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePlayer } from '@/stores/player';
import { artistLine, pickImage } from '@/lib/utils';
import { Icon } from '@/components/ui/Icon';
import { TrackList } from '@/components/sections/TrackList';

export function LibraryExperience() {
  const queue = usePlayer((state) => state.queue);
  const order = usePlayer((state) => state.order);
  const orderPos = usePlayer((state) => state.orderPos);
  const track = usePlayer((state) => state.currentTrack());
  const setQueueOpen = usePlayer((state) => state.setQueueOpen);
  const isPlaying = usePlayer((state) => state.isPlaying);
  const toggle = usePlayer((state) => state.toggle);
  const nextUp = order.slice(orderPos + 1).map((index) => queue[index]).filter(Boolean);

  return (
    <div className="app-page">
      <section>
        <h1 className="text-h2 font-extrabold tracking-[-0.04em] sm:text-h1">Your space</h1>
        <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-text-secondary">The current listening queue is available while this page is open. It is not saved as a permanent library yet.</p>
      </section>

      {track ? (
        <section className="premium-panel overflow-hidden">
          <div className="flex flex-col gap-5 p-4 sm:flex-row sm:items-center sm:p-5">
            <div className="relative aspect-square w-full max-w-[160px] overflow-hidden rounded-card sm:w-28"><Image src={pickImage(track.image)} alt={track.name} fill sizes="160px" className="object-cover" /></div>
            <div className="min-w-0 flex-1"><p className="text-[12px] text-text-secondary">Now playing</p><h2 className="mt-1 truncate text-h3 font-bold">{track.name}</h2><p className="mt-1 truncate text-[15px] text-text-secondary">{artistLine(track)}</p><p className="mt-3 text-[12px] text-text-muted">{queue.length} {queue.length === 1 ? 'track' : 'tracks'} in this queue</p></div>
            <div className="flex shrink-0 gap-2"><button type="button" onClick={toggle} className="button-primary min-w-[100px]"><Icon name={isPlaying ? 'pause' : 'play'} size={15} />{isPlaying ? 'Pause' : 'Play'}</button><button type="button" onClick={() => setQueueOpen(true)} className="button-secondary"><Icon name="queue" size={16} />Queue</button></div>
          </div>
        </section>
      ) : <SessionEmpty />}

      {queue.length > 0 && (
        <section>
          <div className="mb-4 flex items-end justify-between gap-3"><h2 className="section-title">Current queue</h2><button type="button" onClick={() => setQueueOpen(true)} className="control-pill">Manage queue</button></div>
          <div className="premium-panel p-2 sm:p-3"><TrackList songs={queue} /></div>
          {nextUp.length > 0 && <p className="mt-3 text-[12px] text-text-muted">{nextUp.length} track{nextUp.length === 1 ? '' : 's'} remaining after the song in progress.</p>}
        </section>
      )}

      <section className="border-t border-white/10 pt-6"><h2 className="text-[16px] font-bold">Saved music</h2><p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-text-secondary">MusicArea keeps your profile, language choices and player preferences locally. Saved songs, playlists and listening history are not available yet.</p><div className="mt-4 flex flex-wrap gap-3"><Link href="/explore" className="button-secondary">Explore music</Link><Link href="/search" className="button-secondary">Search catalogue</Link></div></section>
    </div>
  );
}

function SessionEmpty() {
  return <section className="premium-panel flex flex-col items-center justify-center p-8 text-center sm:p-12"><span className="grid h-12 w-12 place-items-center rounded-full bg-white/[0.08] text-white"><Icon name="disc" size={22} /></span><h2 className="mt-4 text-h4 font-bold">Nothing is playing</h2><p className="mt-2 max-w-md text-[14px] leading-relaxed text-text-secondary">Start a song from Home, Explore, Charts or Search. Its active queue will appear here for this session.</p></section>;
}
