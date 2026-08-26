import type { Metadata } from 'next';
import { api } from '@/lib/api';
import { preferredLanguages } from '@/lib/languages';
import type { BrowseData, Row, Song } from '@/lib/types';
import { isSong } from '@/lib/utils';
import { Hero } from '@/components/sections/Hero';
import { Carousel } from '@/components/sections/Carousel';
import { MoodGrid } from '@/components/sections/MoodGrid';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/Icon';

export const metadata: Metadata = {
  title: 'Explore',
  description: 'Explore trending songs, new releases, charts, playlists and moods on MusicArea.',
  alternates: { canonical: '/explore' },
};

export const revalidate = 300;

export default async function ExplorePage() {
  let browse: BrowseData | null = null;
  try { browse = await api.browse(preferredLanguages()); } catch { browse = null; }
  if (!browse) return <div className="app-page"><EmptyState title="Explore is taking a breather" message="The catalogue could not be reached right now. Please refresh and try again." ctaHref="/" ctaLabel="Back to Home" /></div>;
  const hero = firstSong(browse.rows);
  return <div className="app-page"><section className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="section-kicker">The music is moving</p><h1 className="mt-2 text-h2 font-extrabold tracking-[-0.04em] sm:text-h1">Explore the <span className="headline-gradient">night.</span></h1><p className="mt-2 max-w-xl text-[15px] text-text-secondary">Fresh songs, albums, playlists and moods from the catalogue, shaped by your selected languages.</p></div><div className="inline-flex w-fit items-center gap-2 rounded-full border border-cyan-200/20 bg-cyan-300/10 px-3 py-1.5 text-[12px] font-bold text-cyan-100"><Icon name="sparkle" size={15} />New sounds every visit</div></section>{hero && <Hero song={hero} />}{browse.rows.map((row) => <Carousel key={`${row.id}-${row.title}`} row={withExploreLinks(row)} />)}<MoodGrid moods={browse.moods} heading="Mood, moment, motion" /></div>;
}

function firstSong(rows: Row[]): Song | undefined { for (const row of rows) { const song = row.items.find(isSong); if (song) return song; } return undefined; }
function withExploreLinks(row: Row): Row { if (row.id === 'charts') return { ...row, showAll: '/charts' }; return row; }
