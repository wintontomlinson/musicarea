'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import type { Mood, SearchAllData, SearchResult, Song } from '@/lib/types';
import { MoodGrid } from '@/components/sections/MoodGrid';
import { TrackList } from '@/components/sections/TrackList';
import { Icon } from '@/components/ui/Icon';
import { usePlayer } from '@/stores/player';
import { useHistory } from '@/stores/history';
import { decodeEntities, resultHref, resultImage, resultSubtitle } from './resultHelpers';

type Tab = 'all' | 'songs' | 'artists' | 'albums' | 'playlists';
const TABS: Tab[] = ['all', 'songs', 'artists', 'albums', 'playlists'];

/**
 * Search, arranged the way Apple Music does it: a rounded search field, category
 * tiles before you type, an instant suggestion sheet while typing, then results
 * behind a segmented control. The query is mirrored to the URL (?q=) so results
 * are shareable and browser history works.
 */
export function SearchExperience({ moods, initialQuery }: { moods: Mood[]; initialQuery: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [input, setInput] = useState(initialQuery);
  const [committed, setCommitted] = useState(initialQuery);
  const [tab, setTab] = useState<Tab>('all');

  const [suggest, setSuggest] = useState<SearchAllData | null>(null);
  const [showSuggest, setShowSuggest] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  /**
   * Results are held as one object tagged with the query they belong to, rather
   * than as separate `results` / `songs` / `loading` / `failed` flags. Tagging
   * makes "these results are for the query on screen" checkable, so a slow
   * response for an abandoned query can never repaint over a newer one, and it
   * lets `loading` be derived instead of toggled from inside the effect.
   */
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

  // Mirror the URL query into local state. Derived from `params` during render
  // rather than assigned from an effect: writing state in an effect for this
  // costs an extra render pass and shows one frame of the stale query.
  const urlQuery = params.get('q') ?? '';
  const [syncedQuery, setSyncedQuery] = useState(urlQuery);
  if (urlQuery !== syncedQuery) {
    setSyncedQuery(urlQuery);
    setInput(urlQuery);
    setCommitted(urlQuery);
  }

  // Debounced suggestions while typing. Nothing is cleared here on the way out:
  // the sheet is gated on the query still being unsubmitted at render time, so
  // stale suggestions cannot be shown even while they are still in state.
  useEffect(() => {
    const q = input.trim();
    if (!q || q === committed) return;
    const controller = new AbortController();
    const id = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
        });
        if (!res.ok) return;
        setSuggest((await res.json()) as SearchAllData);
        setShowSuggest(true);
      } catch {
        /* aborted, or a transient suggest failure: leave the sheet as it is */
      }
    }, 220);
    return () => {
      clearTimeout(id);
      // Cancel the in-flight request too. Without this, a slow response for an
      // earlier keystroke could land after a later one and repaint stale
      // suggestions.
      controller.abort();
    };
  }, [input, committed]);

  // Load full results when a query is committed.
  useEffect(() => {
    const q = committed;
    if (!q) return;
    const controller = new AbortController();

    (async () => {
      try {
        const [all, songs] = await Promise.all([
          fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: controller.signal }),
          fetch(`/api/search/songs?q=${encodeURIComponent(q)}`, { signal: controller.signal }),
        ]);
        // A failure on both sides is a failure to report, not an empty result
        // set. Showing "No songs found" for a 502 tells the listener their query
        // matched nothing, which is a different and wrong thing to say.
        if (!all.ok && !songs.ok) throw new Error('search failed');
        const nextResults = all.ok ? ((await all.json()) as SearchAllData) : null;
        const nextSongs = songs.ok ? (((await songs.json()) as Song[]) ?? []) : [];
        if (controller.signal.aborted) return;
        setPayload({ query: q, results: nextResults, songs: nextSongs, failed: false });
      } catch {
        if (controller.signal.aborted) return;
        setPayload({ query: q, results: null, songs: [], failed: true });
      }
    })();

    // Abandon the request when the query changes or the component unmounts.
    return () => controller.abort();
  }, [committed]);

  // Close the suggestion sheet on outside click.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setShowSuggest(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  function submit(q: string) {
    const trimmed = q.trim();
    setShowSuggest(false);
    setCommitted(trimmed);
    router.replace(trimmed ? `/search?q=${encodeURIComponent(trimmed)}` : '/search');
  }

  return (
    <div className="app-page">
      <section>
        <p className="section-kicker">Find your next favourite</p>
        <h1 className="mt-2 text-h2 font-extrabold tracking-[-0.04em] sm:text-h1">
          Search the <span className="headline-gradient">soundtrack.</span>
        </h1>
        <p className="mt-2 text-[15px] text-text-secondary">Songs, artists, albums and playlists are one search away.</p>
      </section>

      <div ref={boxRef} className="relative w-full max-w-3xl">
        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            submit(input);
          }}
          className="relative"
        >
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-secondary">
            <Icon name="search" size={18} />
          </span>
          <input
            autoFocus
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onFocus={() => suggest && setShowSuggest(true)}
            placeholder="Artists, Songs, Lyrics, and More"
            aria-label="Search"
            className="w-full rounded-xl border border-white/15 bg-[#160d29]/80 py-3.5 pl-11 pr-4 text-[15px] font-medium outline-none transition placeholder:text-text-muted focus:border-fuchsia-300/60 focus:bg-[#1c1031] focus:shadow-glow"
          />
        </form>

        {showSuggest && suggest && input.trim() && input.trim() !== committed && (
          <SuggestSheet data={suggest} onPick={() => setShowSuggest(false)} />
        )}
      </div>

      {/* Before typing: category tiles. After: results. */}
      {!committed ? (
        <MoodGrid moods={moods} heading="Browse Categories" />
      ) : (
        <SearchResults
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

/** Instant suggestions in a translucent sheet under the field. */
function SuggestSheet({ data, onPick }: { data: SearchAllData; onPick: () => void }) {
  const top = data.topQuery?.results?.[0];
  const songs = data.songs?.results?.slice(0, 4) ?? [];
  const artists = data.artists?.results?.slice(0, 3) ?? [];

  if (!top && !songs.length && !artists.length) return null;

  const rows = top ? [top, ...songs, ...artists] : [...songs, ...artists];

  return (
    <div className="glass-panel absolute z-40 mt-2 w-full overflow-hidden rounded-xl2 border border-fuchsia-300/20 p-1.5 shadow-glow">
      {rows.map((r) => (
        <Link
          key={`${r.type}-${r.id}`}
          href={resultHref(r)}
          onClick={onPick}
          className="flex items-center gap-3 rounded-md p-2 transition-colors hover:bg-white/[0.08]"
        >
          <span
            className={`relative h-10 w-10 shrink-0 overflow-hidden ${
              r.type === 'artist' ? 'rounded-full' : 'rounded'
            }`}
          >
            <Image src={resultImage(r)} alt="" fill sizes="40px" className="object-cover" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[14px] font-medium leading-tight">
              {decodeEntities(r.title)}
            </span>
            <span className="block truncate text-[13px] leading-tight text-text-secondary">
              {resultSubtitle(r)}
            </span>
          </span>
        </Link>
      ))}
    </div>
  );
}

function SearchResults({
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
  setTab: (t: Tab) => void;
  results: SearchAllData | null;
  songResults: Song[];
  loading: boolean;
  failed: boolean;
}) {
  const playQueue = usePlayer((s) => s.playQueue);
  const logEvent = useHistory((s) => s.log);
  const top = results?.topQuery?.results?.[0];
  const artists = results?.artists?.results ?? [];
  const albums = results?.albums?.results ?? [];
  const playlists = results?.playlists?.results ?? [];

  return (
    <div>
      {/* Apple's segmented control. */}
      <div role="tablist" className="no-scrollbar mb-7 flex overflow-x-auto">
        <div className="segmented">
          {TABS.map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`segmented-item shrink-0 ${tab === t ? 'segmented-item-active' : ''}`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {loading && <p className="text-[13px] text-text-secondary">Searching for “{query}”…</p>}

      {!loading && failed && (
        <div className="rounded-xl2 border border-amber-300/25 bg-amber-400/[0.06] p-5">
          <h2 className="text-[15px] font-bold text-amber-100">Search is unavailable</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-amber-50/70">
            The catalogue could not be reached, so there are no results to show for &ldquo;{query}
            &rdquo;. This is not the same as finding nothing: try again in a moment.
          </p>
        </div>
      )}

      {!loading && !failed && (
        <div className="flex flex-col gap-10">
          {(tab === 'all' || tab === 'songs') && (
            <div className="grid gap-8 lg:grid-cols-[minmax(0,300px)_1fr]">
              {tab === 'all' && top && (
                <div>
                  <h2 className="mb-3 section-title">Top Result</h2>
                  <TopResultCard result={top} />
                </div>
              )}
              <div className={tab === 'all' ? '' : 'lg:col-span-2'}>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h2 className="section-title">Songs</h2>
                  {songResults.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        // Playing a search result is a stronger signal than a
                        // shelf tap: the listener named what they wanted.
                        if (songResults[0]) logEvent(songResults[0], 'search_play');
                        playQueue(songResults, 0);
                      }}
                      className="text-[13px] font-medium text-accent transition-colors hover:text-accent-soft"
                    >
                      Play all
                    </button>
                  )}
                </div>
                {songResults.length ? (
                  <TrackList songs={songResults.slice(0, tab === 'all' ? 6 : 30)} />
                ) : (
                  <p className="text-[13px] text-text-secondary">No songs found.</p>
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
      className="surface-card group flex flex-col items-center gap-4 p-6 text-center transition duration-300 hover:-translate-y-1 hover:border-fuchsia-300/35 hover:bg-surface-raised hover:shadow-glow"
    >
      <span
        className={`relative block h-28 w-28 overflow-hidden shadow-lift ${
          result.type === 'artist' ? 'rounded-full' : 'rounded-card'
        }`}
      >
        <Image src={resultImage(result)} alt="" fill sizes="112px" className="object-cover" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[17px] font-semibold">
          {decodeEntities(result.title)}
        </span>
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
      <h2 className="mb-3 section-title">{title}</h2>
      <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-5">
        {items.map((r) => (
          <Link key={r.id} href={resultHref(r)} className="group block transition duration-300 hover:-translate-y-1">
            <span
              className={`relative mb-2 block aspect-square overflow-hidden shadow-lift ${
                circular ? 'rounded-full' : 'rounded-card'
              }`}
            >
              <Image
                src={resultImage(r)}
                alt=""
                fill
                sizes="200px"
                className="object-cover"
              />
            </span>
            <p
              className={`truncate text-[14px] font-medium leading-tight ${
                circular ? 'text-center' : ''
              }`}
            >
              {decodeEntities(r.title)}
            </p>
            <p
              className={`mt-0.5 truncate text-[13px] leading-tight text-text-secondary ${
                circular ? 'text-center' : ''
              }`}
            >
              {resultSubtitle(r)}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}
