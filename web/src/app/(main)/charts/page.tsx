import type { Metadata } from 'next';
import Link from 'next/link';
import { api } from '@/lib/api';
import type { ChartCard, Playlist } from '@/lib/types';
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

// No `revalidate` here: reading `searchParams` for the ?c= selection makes this
// route dynamic, so a route-level revalidate window would never apply. The
// per-fetch `next.revalidate` in lib/api.ts is what caches the chart data.

function chartLabel(c: ChartCard): string {
  return c.name || c.title || 'Chart';
}

export default async function ChartsPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const { c: requestedChart } = await searchParams;
  let charts: ChartCard[] = [];
  try {
    charts = (await api.charts()).items ?? [];
  } catch {
    charts = [];
  }

  if (!charts.length) {
    return (
      <div className="app-page">
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
  // Resolve the object first and derive the id from it, so an unknown ?c= value
  // falls back to a chart that definitely exists rather than needing an
  // assertion that the lookup succeeded.
  const selected = charts.find((c) => c.id === requestedChart) ?? charts[0];
  const selectedId = selected.id;

  let playlist: Playlist | null = null;
  try {
    playlist = await api.playlist(selectedId, 50);
  } catch {
    playlist = null;
  }
  const songs = playlist?.songs ?? [];

  return (
    <div className="app-page">
      <JsonLd
        data={breadcrumbLd([
          { name: 'Home', path: '/' },
          { name: 'Charts', path: '/charts' },
        ])}
      />

      <div>
        <h1 className="text-h2 font-bold tracking-tight sm:text-h1">Charts</h1>
        <p className="mt-1 text-[15px] text-text-secondary">
          The biggest songs right now, by language and genre.
        </p>
      </div>

      {/* Chart selector doubles as the language/genre filter. */}
      <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {charts.map((c) => (
          <Link
            key={c.id}
            href={`/charts?c=${c.id}`}
            scroll={false}
            aria-current={c.id === selectedId ? 'page' : undefined}
            className={`shrink-0 rounded-lg px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
              c.id === selectedId
                ? 'bg-accent/[0.16] text-accent'
                : 'bg-white/[0.08] text-text-secondary hover:bg-white/[0.14] hover:text-white'
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
              <h2 className="truncate section-title">{chartLabel(selected)}</h2>
              <p className="mt-0.5 text-[13px] text-text-secondary">{songs.length} songs</p>
            </div>
            <div className="ml-auto">
              <CollectionActions songs={songs} />
            </div>
          </div>
          <ChartList songs={songs} />
          <p className="text-[12px] text-text-muted">
            Ranked by the chart&rsquo;s own order. Position-change indicators need historical data the
            catalogue does not publish, so movement is not shown.
          </p>
        </>
      ) : (
        <p className="text-[13px] text-text-secondary">This chart has no playable tracks right now.</p>
      )}
    </div>
  );
}
