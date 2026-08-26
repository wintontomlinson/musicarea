import type { Metadata } from 'next';
import Link from 'next/link';
import { api } from '@/lib/api';
import type { ChartCard, Playlist } from '@/lib/types';
import { SITE } from '@/lib/config';
import { ChartList } from '@/components/sections/ChartList';
import { CollectionActions } from '@/components/player/CollectionActions';
import { CollectionMenu } from '@/components/collections/CollectionMenu';
import { EmptyState } from '@/components/ui/EmptyState';
import { JsonLd, breadcrumbLd } from '@/components/seo/JsonLd';

export const metadata: Metadata = {
  title: 'Charts',
  description: `The most played songs right now on ${SITE.name}, by language and genre.`,
  alternates: { canonical: '/charts' },
};

export const revalidate = 600;

function chartLabel(chart: ChartCard): string {
  return chart.name || chart.title || 'Chart';
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
      <div className="page page-stack">
        <EmptyState
          icon="wifiOff"
          title="Charts are unavailable"
          message="The chart service could not be reached. Try again shortly."
          ctaHref="/"
          ctaLabel="Back to Home"
        />
      </div>
    );
  }

  const selectedId =
    searchParams.c && charts.some((chart) => chart.id === searchParams.c)
      ? searchParams.c
      : charts[0].id;
  const selected = charts.find((chart) => chart.id === selectedId)!;

  let playlist: Playlist | null = null;
  try {
    playlist = await api.playlist(selectedId, 50);
  } catch {
    playlist = null;
  }
  const songs = playlist?.songs ?? [];

  return (
    <div className="page page-stack">
      <JsonLd
        data={breadcrumbLd([
          { name: 'Home', path: '/' },
          { name: 'Charts', path: '/charts' },
        ])}
      />

      <header>
        <h1 className="t-display">Charts</h1>
        <p className="mt-2.5 text-body text-text-secondary">
          The most played songs right now, by language and genre.
        </p>
      </header>

      {/* Chart picker. Server-rendered links so a chart is shareable by URL. */}
      <nav aria-label="Charts" className="bleed-row no-scrollbar -mt-4 pb-1">
        {charts.map((chart) => {
          const active = chart.id === selectedId;
          return (
            <Link
              key={chart.id}
              href={`/charts?c=${chart.id}`}
              scroll={false}
              aria-current={active ? 'page' : undefined}
              className={`chip shrink-0 snap-start ${active ? 'chip-active' : ''}`}
            >
              {chartLabel(chart)}
            </Link>
          );
        })}
      </nav>

      {songs.length > 0 ? (
        <section aria-labelledby="chart-heading">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              <h2 id="chart-heading" className="truncate text-section">
                {chartLabel(selected)}
              </h2>
              <p className="mt-1 t-meta">{songs.length} songs</p>
            </div>
            <CollectionActions songs={songs}>
              <CollectionMenu
                title={chartLabel(selected)}
                path={`/charts?c=${selectedId}`}
                songs={songs}
              />
            </CollectionActions>
          </div>

          <ChartList songs={songs} />

          <p className="mt-6 text-micro text-text-muted">
            Ordered as the chart publishes it. Position change indicators need historical data the
            catalogue does not provide, so movement is not shown.
          </p>
        </section>
      ) : (
        <EmptyState
          compact
          title="No playable tracks"
          message="This chart has nothing streamable right now. Try another chart."
        />
      )}
    </div>
  );
}
