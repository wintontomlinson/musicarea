import type { Metadata } from 'next';
import Link from 'next/link';
import { api } from '@/lib/api';
import type { ChartCard, Playlist } from '@/lib/types';
import { pickImage } from '@/lib/utils';
import { SITE } from '@/lib/config';
import { ChartList } from '@/components/sections/ChartList';
import { CollectionActions } from '@/components/player/CollectionActions';
import { EmptyState } from '@/components/ui/EmptyState';
import { JsonLd, breadcrumbLd } from '@/components/seo/JsonLd';

export const metadata: Metadata = {
  title: 'Charts',
  description: `The top songs right now on ${SITE.name}: superhit charts by language and genre.`,
  alternates: { canonical: '/charts' },
  openGraph: {
    title: `Charts | ${SITE.name}`,
    description: `The top songs right now on ${SITE.name}.`,
  },
};

export const revalidate = 600;

function chartLabel(c: ChartCard): string {
  return c.name || c.title || 'Chart';
}

export default async function ChartsPage({ searchParams }: { searchParams: { c?: string } }) {
  let charts: ChartCard[] = [];
  try {
    charts = (await api.charts()).items ?? [];
  } catch {
    charts = [];
  }

  if (!charts.length) {
    return (
      <div className="px-4 sm:px-6">
        <EmptyState
          title="Charts are unavailable"
          message="The chart service could not be reached. Please try again shortly."
          ctaHref="/"
          ctaLabel="Back to Home"
        />
      </div>
    );
  }

  // Selected chart (defaults to the first). Then open it to get the ranked songs.
  const selectedId = searchParams.c && charts.some((c) => c.id === searchParams.c) ? searchParams.c : charts[0].id;
  const selected = charts.find((c) => c.id === selectedId)!;

  let playlist: Playlist | null = null;
  try {
    playlist = await api.playlist(selectedId, 50);
  } catch {
    playlist = null;
  }
  const songs = playlist?.songs ?? [];

  return (
    <div className="flex flex-col gap-8 px-4 py-6 sm:px-6">
      <JsonLd
        data={breadcrumbLd([
          { name: 'Home', path: '/' },
          { name: 'Charts', path: '/charts' },
        ])}
      />

      <div>
        <h1 className="text-h2 font-extrabold tracking-tight">Charts</h1>
        <p className="mt-1 text-sm text-text-secondary">
          The biggest songs right now, by language and genre.
        </p>
      </div>

      {/* Chart selector doubles as the language/genre filter. */}
      <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
        {charts.map((c) => (
          <Link
            key={c.id}
            href={`/charts?c=${c.id}`}
            scroll={false}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-colors duration-150 ${
              c.id === selectedId ? 'bg-white text-black' : 'bg-white/5 text-text-secondary hover:text-white'
            }`}
          >
            {chartLabel(c)}
          </Link>
        ))}
      </div>

      {/* Selected chart header + play */}
      {playlist && songs.length > 0 ? (
        <>
          <div className="flex flex-wrap items-center gap-4">
            <div className="min-w-0">
              <h2 className="truncate text-h4 font-extrabold tracking-tight">{chartLabel(selected)}</h2>
              <p className="text-sm text-text-secondary">{songs.length} songs</p>
            </div>
            <div className="ml-auto">
              <CollectionActions songs={songs} />
            </div>
          </div>
          <ChartList songs={songs} />
          <p className="text-xs text-text-muted">
            Ranked by the chart&rsquo;s own order. Position-change indicators need historical data the
            catalogue does not publish, so movement is not shown.
          </p>
        </>
      ) : (
        <p className="text-sm text-text-secondary">This chart has no playable tracks right now.</p>
      )}
    </div>
  );
}
