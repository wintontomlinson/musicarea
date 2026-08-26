import type { Metadata } from 'next';
import { api } from '@/lib/api';
import type { BrowseData, FeedData, Row, Song } from '@/lib/types';
import { isSong, greeting } from '@/lib/utils';
import { Hero } from '@/components/sections/Hero';
import { Carousel } from '@/components/sections/Carousel';
import { MoodGrid } from '@/components/sections/MoodGrid';
import { EmptyState } from '@/components/ui/EmptyState';
import { SITE } from '@/lib/config';
import { preferredLanguages } from '@/lib/languages';
import { Icon } from '@/components/ui/Icon';

export const metadata: Metadata = { title: `${SITE.name} · Discover and stream music`, description: SITE.description, alternates: { canonical: '/' } };
export const revalidate = 300;

export default async function HomePage() {
  const languages = preferredLanguages();
  const [browseRes, feedRes] = await Promise.allSettled([api.browse(languages), api.feed({ history: [], languages, limit: 12 })]);
  const browse: BrowseData | null = browseRes.status === 'fulfilled' ? browseRes.value : null;
  const feed: FeedData | null = feedRes.status === 'fulfilled' ? feedRes.value : null;
  if (!browse && !feed) return <div className="px-4 sm:px-6"><EmptyState title="Could not reach the music service" message="The catalogue is momentarily unavailable. Check the API connection and refresh." ctaHref="/" ctaLabel="Try again" /></div>;
  const hero = firstSong(feed?.rows) || firstSong(browse?.rows);
  const rows: Row[] = [];
  if (feed?.rows) rows.push(...feed.rows);
  if (browse?.rows) for (const row of browse.rows) rows.push(row.id === 'trending' ? { ...row, showAll: '/explore' } : row);
  return <div className="app-page"><section className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="section-kicker">MusicArea presents</p><h1 className="mt-2 text-h2 font-extrabold tracking-[-0.04em] sm:text-h1">{greeting()}, <span className="headline-gradient">let&apos;s move.</span></h1><p className="mt-2 max-w-xl text-[15px] text-text-secondary">Your selected languages set the scene. Choose a song and keep the queue going.</p></div><div className="inline-flex w-fit items-center gap-2 rounded-full border border-fuchsia-300/25 bg-fuchsia-400/10 px-3 py-1.5 text-[12px] font-bold text-accent-soft"><Icon name="disc" size={15} />Turn up your world</div></section>{hero && <Hero song={hero} />}{rows.map((row) => <Carousel key={`${row.id}-${row.title}`} row={row} />)}{browse?.moods && <MoodGrid moods={browse.moods} heading="Pick a mood and press play" />}</div>;
}

function firstSong(rows?: Row[]): Song | undefined { if (!rows) return undefined; for (const row of rows) { for (const item of row.items) { if (isSong(item)) return item; } } return undefined; }
