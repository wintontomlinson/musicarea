'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { m } from 'motion/react';
import type { Mood, SearchAllData, SearchResult, Song } from '@/lib/types';
import { MoodGrid } from '@/components/sections/MoodGrid';
import { TrackList } from '@/components/sections/TrackList';
import { Icon } from '@/components/ui/Icon';
import { Tabs } from '@/components/ui/Tabs';
import { SkeletonRow } from '@/components/ui/Skeleton';
import { usePlayer } from '@/stores/player';
import { useSearchHistory } from '@/stores/search';
import { fadeUp, staggerContainer, staggerItem } from '@/lib/motion';
import { SearchField } from './SearchField';
import { TrendingChips } from './TrendingChips';
import { RecentSearches } from './RecentSearches';
import { decodeEntities, resultHref, resultImage, resultSubtitle } from './resultHelpers';

type Tab = 'all' | 'songs' | 'artists' | 'albums' | 'playlists';

const TABS = [
  { id: 'all' as const, label: 'All' },
  { id: 'songs' as const, label: 'Songs' },
  { id: 'artists' as const, label: 'Artists' },
  { id: 'albums' as const, label: 'Albums' },
  { id: 'playlists' as const, label: 'Playlists' },
];

/**
 * Search.
 *
 * Three states, and which one shows is decided entirely by whether a query is committed:
 * an idle state with recent searches, trending suggestions and mood tiles; a suggestion
 * sheet while typing; and results behind a tab strip.
 *
 * The data-fetching design is carried over unchanged from the previous version because it was
 * already right, and it is worth restating why. Results are held as *one object tagged with
 * the query they belong to*, rather than as separate results/songs/loading/failed fields.
 * Tagging makes "these results are for the query on screen" a checkable fact, so a slow
 * response for an abandoned query can never repaint over a newer one, and it lets `loading` be
 * derived rather than toggled from inside an effect.
 */
export function SearchExperience({
  moods,
  trending,
  initialQuery,
}: {
  moods: Mood[];
  trending: string[];
  initialQuery: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const record = useSearchHistory((state) => state.record);

  const [input, setInput] = useState(initialQuery);
  const [committed, setCommitted] = useState(initialQuery);
  const [tab, setTab] = useState<Tab>('all');

  const [suggest, setSuggest] = useState<SearchAllData | null>(null);
  const [showSuggest, setShowSuggest] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const [payload, setPayload] = useState<{
    query: string;
    results: SearchAllData | null;
    songs: Song[];
    failed: boolean;
  } | null>(null);

  const settled = payload?.query === committed ? payload : null;
  const loading = Boolean(committed) && !settled;
  const results = settled?.results ?? null;
  const songResults = settled?.songs ?? [];
  const failed = settled?.failed ?? false;

  // The URL query is mirrored into local state during render rather than from an effect.
  // Assigning it in an effect costs an extra render pass and shows one frame of the stale
  // query, which is visible when arriving from the toolbar search.
  const urlQuery = params.get('q') ?? '';
  const [syncedQuery, setSyncedQuery] = useState(urlQuery);
  if (urlQuery !== syncedQuery) {
    setSyncedQuery(urlQuery);
    setInput(urlQuery);
    setCommitted(urlQuery);
  }

  // Debounced suggestions while typing. Nothing is cleared on the way out: the sheet is gated
  // at render time on the query still being unsubmitted, so stale suggestions cannot be shown
  // even while they are still in state.
  useEffect(() => {
    const query = input.trim();
    if (!query || query === committed) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        if (!res.ok) return;
        setSuggest((await res.json()) as SearchAllData);
        setShowSuggest(true);
      } catch {
        /* aborted, or a transient failure: leave the sheet as it is */
      }
    }, 220);
    return () => {
      window.clearTimeout(timer);
      // The in-flight request is cancelled too. Without this a slow response for an earlier
      // keystroke could land after a later one and repaint stale suggestions.
      controller.abort();
    };
  }, [input, committed]);

  // Full results once a query is committed.
  useEffect(() => {
    const query = committed;
    if (!query) return;
    const controller = new AbortController();

    (async () => {
      try {
        const [all, songs] = await Promise.all([
          fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal: controller.signal }),
          fetch(`/api/search/songs?q=${encodeURIComponent(query)}`, { signal: controller.signal }),
        ]);
        // Both failing is a failure to report, not an empty result set. Showing "no results"
        // for a 502 tells the listener their query matched nothing, which is a different and
        // wrong thing to say.
        if (!all.ok && !songs.ok) throw new Error('search failed');
        const nextResults = all.ok ? ((await all.json()) as SearchAllData) : null;
        const nextSongs = songs.ok ? (((await songs.json()) as Song[]) ?? []) : [];
        if (controller.signal.aborted) return;
        setPayload({ query, results: nextResults, songs: nextSongs, failed: false });
      } catch {
        if (controller.signal.aborted) return;
        setPayload({ query, results: null, songs: [], failed: true });
      }
    })();

    return () => controller.abort();
  }, [committed]);

  // Close the suggestion sheet on an outside click.
  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(event.target as Node)) setShowSuggest(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  function submit(query: string) {
    const trimmed = query.trim();
    setShowSuggest(false);
    setInput(trimmed);
    setCommitted(trimmed);
    // Recorded only on commit, not on every keystroke, so the history holds searches the
    // listener actually ran rather than every prefix they typed on the way there.
    if (trimmed) record(trimmed);
    // `replace` rather than `push`: each refinement of a query should not become a separate
    // back-button step, or leaving the page means pressing back once per character typed.
    router.replace(trimmed ? `/search?q=${encodeURIComponent(trimmed)}` : '/search');
  }

  return (
    <div className="app-page">
      <section>
        <p className="section-kicker">Find your next favourite</p>
        <h1 className="mt-2 font-display text-h2 font-extrabold tracking-[-0.045em] sm:text-h1">
          What do you want to hear?
        </h1>
      </section>

      <div ref={boxRef}>
        <SearchField
          value={input}
          onChange={setInput}
          onSubmit={submit}
          onFocus={() => suggest && setShowSuggest(true)}
        >
          {showSuggest && suggest && input.trim() && input.trim() !== committed && (
            <SuggestSheet data={suggest} onPick={() => setShowSuggest(false)} />
          )}
        </SearchField>
      </div>

      {!committed ? (
        <m.div variants={fadeUp} initial="hidden" animate="show" className="flex flex-col gap-10">
          <RecentSearches onPick={submit} />
          <TrendingChips queries={trending} onPick={submit} />
          <MoodGrid moods={moods} heading="Browse by mood" />
        </m.div>
      ) : (
        <Results
          query={committed}
          tab={tab}
          setTab={setTab}
          results={results}
          songResults={songResults}
          loading={loading}
          failed={failed}
        />
      )}
    </div>
  );
}

/** Instant suggestions under the field. */
function SuggestSheet({ data, onPick }: { data: SearchAllData; onPick: () => void }) {
  const top = data.topQuery?.results?.[0];
  const songs = data.songs?.results?.slice(0, 4) ?? [];
  const artists = data.artists?.results?.slice(0, 3) ?? [];

  if (!top && !songs.length && !artists.length) return null;

  // The top result is prepended rather than shown separately, so the sheet stays one scannable
  // list. It is usually also present in one of the other groups, hence the dedupe by key.
  const seen = new Set<string>();
  const rows = [...(top ? [top] : []), ...songs, ...artists].filter((row) => {
    const key = `${row.type}-${row.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return (
    <div className="glass-panel absolute z-40 mt-2 w-full overflow-hidden rounded-card-lg border border-accent/20 p-1.5 shadow-glow">
      {rows.map((row) => (
        <Link
          key={`${row.type}-${row.id}`}
          href={resultHref(row)}
          onClick={onPick}
          className="flex items-center gap-3 rounded-card p-2 transition-colors hover:bg-white/[0.08]"
        >
          <span
            className={`relative h-10 w-10 shrink-0 overflow-hidden ${
              row.type === 'artist' ? 'rounded-full' : 'rounded-[8px]'
            }`}
          >
            <Image src={resultImage(row)} alt="" fill sizes="40px" className="object-cover" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[14px] font-semibold leading-tight">
              {decodeEntities(row.title)}
            </span>
            <span className="block truncate text-[12.5px] leading-tight text-text-secondary">
              {resultSubtitle(row)}
            </span>
          </span>
        </Link>
      ))}
    </div>
  );
}

function Results({
  query,
  tab,
  setTab,
  results,
  songResults,
  loading,
  failed,
}: {
  query: string;
  tab: Tab;
  setTab: (tab: Tab) => void;
  results: SearchAllData | null;
  songResults: Song[];
  loading: boolean;
  failed: boolean;
}) {
  const playQueue = usePlayer((state) => state.playQueue);
  const top = results?.topQuery?.results?.[0];
  const artists = results?.artists?.results ?? [];
  const albums = results?.albums?.results ?? [];
  const playlists = results?.playlists?.results ?? [];

  // Counts on the tabs, so it is obvious which categories have anything in them before
  // switching to one and finding it empty.
  const items = TABS.map((entry) => {
    const count =
      entry.id === 'songs'
        ? songResults.length
        : entry.id === 'artists'
          ? artists.length
          : entry.id === 'albums'
            ? albums.length
            : entry.id === 'playlists'
              ? playlists.length
              : undefined;
    return { ...entry, badge: loading || count === undefined ? undefined : count };
  });

  const nothingFound =
    !loading &&
    !failed &&
    !top &&
    songResults.length === 0 &&
    artists.length === 0 &&
    albums.length === 0 &&
    playlists.length === 0;

  return (
    <div>
      <Tabs items={items} value={tab} onChange={setTab} label="Result categories" className="mb-6" />

      {loading && (
        <div className="flex flex-col gap-1" aria-busy="true">
          <p className="mb-2 text-[13px] text-text-secondary">Searching for “{query}”…</p>
          {Array.from({ length: 6 }, (_, index) => (
            <SkeletonRow key={index} />
          ))}
        </div>
      )}

      {!loading && failed && (
        <div className="rounded-card-lg border border-amber-300/25 bg-amber-400/[0.06] p-5">
          <h2 className="text-[15px] font-bold text-amber-100">Search is unavailable</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-amber-50/70">
            The catalogue could not be reached, so there are no results to show for “{query}”. This
            is not the same as finding nothing: try again in a moment.
          </p>
        </div>
      )}

      {nothingFound && (
        <div className="premium-panel p-8 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-white/[0.07] text-text-secondary">
            <Icon name="search" size={22} />
          </span>
          <h2 className="mt-3 text-h4 font-bold">No results for “{query}”</h2>
          <p className="mx-auto mt-2 max-w-md text-[14px] leading-relaxed text-text-secondary">
            Check the spelling, or try an artist name on its own.
          </p>
        </div>
      )}

      {!loading && !failed && !nothingFound && (
        <div className="flex flex-col gap-10">
          {(tab === 'all' || tab === 'songs') && (
            <div className="grid gap-8 lg:grid-cols-[minmax(0,300px)_1fr]">
              {tab === 'all' && top && (
                <div>
                  <h2 className="section-title mb-3">Top result</h2>
                  <TopResultCard result={top} />
                </div>
              )}
              <div className={tab === 'all' ? '' : 'lg:col-span-2'}>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h2 className="section-title">Songs</h2>
                  {songResults.length > 0 && (
                    <button
                      type="button"
                      onClick={() => playQueue(songResults, 0)}
                      className="button-secondary px-4 py-2 text-[13px]"
                    >
                      <Icon name="play" size={14} />
                      Play all
                    </button>
                  )}
                </div>
                {songResults.length ? (
                  <TrackList songs={songResults.slice(0, tab === 'all' ? 6 : 30)} />
                ) : (
                  <p className="text-[13px] text-text-secondary">No songs matched.</p>
                )}
              </div>
            </div>
          )}

          {(tab === 'all' || tab === 'artists') && artists.length > 0 && (
            <ResultGrid title="Artists" items={artists} circular />
          )}
          {(tab === 'all' || tab === 'albums') && albums.length > 0 && (
            <ResultGrid title="Albums" items={albums} />
          )}
          {(tab === 'all' || tab === 'playlists') && playlists.length > 0 && (
            <ResultGrid title="Playlists" items={playlists} />
          )}
        </div>
      )}
    </div>
  );
}

function TopResultCard({ result }: { result: SearchResult }) {
  return (
    <Link
      href={resultHref(result)}
      className="surface-card group flex flex-col items-center gap-4 p-6 text-center transition duration-300 hover:-translate-y-1 hover:border-accent/35 hover:shadow-glow"
    >
      <span
        className={`relative block h-28 w-28 overflow-hidden shadow-lift ${
          result.type === 'artist' ? 'rounded-full' : 'rounded-card'
        }`}
      >
        <Image src={resultImage(result)} alt="" fill sizes="112px" className="object-cover" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[17px] font-bold">{decodeEntities(result.title)}</span>
        <span className="mt-0.5 block truncate text-[13px] text-text-secondary">
          {resultSubtitle(result)}
        </span>
      </span>
    </Link>
  );
}

function ResultGrid({
  title,
  items,
  circular = false,
}: {
  title: string;
  items: SearchResult[];
  circular?: boolean;
}) {
  return (
    <section>
      <h2 className="section-title mb-3">{title}</h2>
      <m.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-5"
      >
        {items.map((row) => (
          <m.div key={`${row.type}-${row.id}`} variants={staggerItem}>
            <Link
              href={resultHref(row)}
              className="group block transition duration-300 hover:-translate-y-1"
            >
              <span
                className={`relative mb-2 block aspect-square overflow-hidden shadow-lift ${
                  circular ? 'rounded-full' : 'rounded-card'
                }`}
              >
                <Image
                  src={resultImage(row)}
                  alt=""
                  fill
                  sizes="200px"
                  className="object-cover transition duration-500 group-hover:scale-105"
                />
              </span>
              <p
                className={`truncate text-[14px] font-bold leading-tight ${circular ? 'text-center' : ''}`}
              >
                {decodeEntities(row.title)}
              </p>
              <p
                className={`mt-0.5 truncate text-[12.5px] leading-tight text-text-secondary ${
                  circular ? 'text-center' : ''
                }`}
              >
                {resultSubtitle(row)}
              </p>
            </Link>
          </m.div>
        ))}
      </m.div>
    </section>
  );
}
