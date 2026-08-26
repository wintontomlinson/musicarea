'use client';

import { useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePlayer } from '@/stores/player';
import { useLibrary } from '@/stores/library';
import { artistLine, pickImage } from '@/lib/utils';
import { Icon, type IconName } from '@/components/ui/Icon';
import { TrackList } from '@/components/sections/TrackList';

export function LibraryExperience() {
  const hydrate = useLibrary((state) => state.hydrate);
  const hydrated = useLibrary((state) => state.hydrated);
  const likedCount = useLibrary((state) => state.liked.length);
  const recentCount = useLibrary((state) => state.recent.length);
  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const queue = usePlayer((state) => state.queue);
  const order = usePlayer((state) => state.order);
  const orderPos = usePlayer((state) => state.orderPos);
  const track = usePlayer((state) => state.currentTrack());
  const setQueueOpen = usePlayer((state) => state.setQueueOpen);
  const isPlaying = usePlayer((state) => state.isPlaying);
  const toggle = usePlayer((state) => state.toggle);

  const nextUp = order.slice(orderPos + 1).map((index) => queue[index]).filter(Boolean);

  return <div className="app-page"><section className="disco-panel p-6 sm:p-8"><div className="max-w-2xl"><p className="section-kicker">Your listening room</p><h1 className="mt-2 text-h2 font-extrabold tracking-[-0.04em] sm:text-h1">Your space, <span className="headline-gradient">right now.</span></h1><p className="mt-3 text-[15px] leading-relaxed text-white/70">Your active queue lives here while you listen. It stays on this device for this session and resets when the page reloads.</p></div><div className="mt-6 flex flex-wrap gap-3"><Link href="/explore" className="button-primary"><Icon name="sparkle" size={16} />Explore music</Link><Link href="/search" className="button-secondary"><Icon name="search" size={16} />Find a track</Link></div></section>
    {track ? <section className="premium-panel overflow-hidden"><div className="flex flex-col gap-5 p-4 sm:flex-row sm:items-center sm:p-5"><div className="relative aspect-square w-full max-w-[180px] overflow-hidden rounded-card border border-white/15 shadow-glow sm:w-32"><Image src={pickImage(track.image)} alt={track.name} fill sizes="180px" className="object-cover" /></div><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className="neon-dot" /><p className="section-kicker">Now on deck</p></div><h2 className="mt-2 truncate text-h3 font-extrabold">{track.name}</h2><p className="mt-1 truncate text-[15px] text-text-secondary">{artistLine(track)}</p><p className="mt-3 text-[12px] text-text-muted">{queue.length} {queue.length === 1 ? 'track' : 'tracks'} in this session queue</p></div><div className="flex shrink-0 gap-2"><button type="button" onClick={toggle} className="button-primary min-w-[110px]"><Icon name={isPlaying ? 'pause' : 'play'} size={15} />{isPlaying ? 'Pause' : 'Play'}</button><button type="button" onClick={() => setQueueOpen(true)} className="button-secondary"><Icon name="queue" size={16} />Queue</button></div></div></section> : <SessionEmpty />}
    {queue.length > 0 && <section><div className="mb-4 flex items-end justify-between gap-3"><div><p className="section-kicker mb-1">Current session</p><h2 className="section-title">Queue</h2></div><button type="button" onClick={() => setQueueOpen(true)} className="control-pill">Manage queue</button></div><div className="premium-panel p-2 sm:p-3"><TrackList songs={queue} /></div>{nextUp.length > 0 && <p className="mt-3 text-[12px] text-text-muted">{nextUp.length} track{nextUp.length === 1 ? '' : 's'} waiting after the one that&apos;s playing.</p>}</section>}
    <section className="grid gap-3 sm:grid-cols-2"><CollectionLink href="/liked" icon="heart" title="Favourites" count={likedCount} hydrated={hydrated} empty="Heart a track to start" /><CollectionLink href="/recent" icon="clock" title="Recent listening" count={recentCount} hydrated={hydrated} empty="Play something to start" /></section></div>;
}

/** Card linking to a stored collection, with its size once known. */
function CollectionLink({ href, icon, title, count, hydrated, empty }: { href: string; icon: IconName; title: string; count: number; hydrated: boolean; empty: string }) {
  return <Link href={href} className="surface-card flex items-center gap-4 p-4 transition hover:-translate-y-0.5 hover:border-fuchsia-300/35 hover:shadow-glow"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-fuchsia-300/30 bg-fuchsia-400/10 text-accent-soft"><Icon name={icon} size={21} /></span><span className="min-w-0 flex-1"><span className="block text-[15px] font-bold">{title}</span><span className="mt-0.5 block text-[13px] text-text-secondary">{!hydrated ? 'Checking this device…' : count ? `${count} ${count === 1 ? 'track' : 'tracks'} saved here` : empty}</span></span><Icon name="chevronRight" size={16} className="shrink-0 text-text-muted" /></Link>;
}

function SessionEmpty() {
  return <section className="premium-panel flex flex-col items-center justify-center p-8 text-center sm:p-12"><span className="grid h-14 w-14 place-items-center rounded-full bg-brand text-white shadow-glow"><Icon name="disc" size={25} /></span><h2 className="mt-4 text-h4 font-extrabold">The floor is open</h2><p className="mt-2 max-w-md text-[14px] leading-relaxed text-text-secondary">Start a song from Home, Explore, Charts or Search. Its active queue will appear here for this listening session.</p></section>;
}
