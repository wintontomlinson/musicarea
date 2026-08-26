import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { api } from '@/lib/api';
import type { MoodSet } from '@/lib/types';
import { TrackList } from '@/components/sections/TrackList';
import { CollectionActions } from '@/components/player/CollectionActions';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/Icon';

export const revalidate = 300;

async function getMood(id: string): Promise<MoodSet | null> { try { return await api.mood(id); } catch { return null; } }

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> { const set = await getMood(params.id); if (!set?.mood) return { title: 'Mood not found' }; return { title: `${set.mood.name} music`, description: `Listen to the ${set.mood.name} music selection on MusicArea.` }; }

export default async function MoodPage({ params }: { params: { id: string } }) {
  const set = await getMood(params.id);
  if (!set) notFound();
  if (!set.mood) return <div className="app-page"><EmptyState title="That mood is unavailable" message="Choose another mood and find your next track." ctaHref="/explore" ctaLabel="Explore moods" /></div>;
  return <div className="app-page"><section className="disco-panel p-6 sm:p-8"><p className="section-kicker">Mood station</p><h1 className="mt-2 text-h2 font-extrabold tracking-[-0.04em] sm:text-h1">{set.mood.name}<span className="headline-gradient">.</span></h1><p className="mt-3 max-w-xl text-[15px] text-white/70">A catalogue-led selection for this moment. Start anywhere and keep the room moving.</p><div className="mt-6"><CollectionActions songs={set.items} /></div></section>{set.items.length ? <section><div className="mb-4 flex items-end justify-between"><div><p className="section-kicker mb-1">Station queue</p><h2 className="section-title">{set.items.length} tracks</h2></div><span className="inline-flex items-center gap-1.5 text-[12px] text-text-secondary"><Icon name="disc" size={15} className="text-accent-soft" />Catalogue order</span></div><div className="premium-panel p-2 sm:p-3"><TrackList songs={set.items} /></div></section> : <EmptyState title="No tracks are available" message="This mood has no playable music right now." ctaHref="/explore" ctaLabel="Explore moods" />}</div>;
}
