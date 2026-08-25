'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import type { Mood, SearchAllData, SearchResult, Song } from '@/lib/types';
import { MoodGrid } from '@/components/sections/MoodGrid';
import { TrackList } from '@/components/sections/TrackList';
import { Icon } from '@/components/ui/Icon';
import { usePlayer } from '@/stores/player';
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
  const [results, setResults] = useState<SearchAllData | null>(null);
  const [songResults, setSongResults] = useState<Song[]>([]);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // Keep local state in sync when the URL query changes (e.g. via the top bar).
  useEffect(() => {
    const q = params.get('q') ?? '';
    setInput(q);
    setCommitted(q);
  }, [params]);

  // Debounced suggestions while typing.
  useEffect(() => {
    const q = input.trim();
    if (!q || q === committed) {
      setSuggest(null);
      return;
    }
    const id = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        if (res.ok) {
          setSuggest((await res.json()) as SearchAllData);
          setShowSuggest(true);
        }
      } catch {
        /* ignore transient suggest errors */
      }
    }, 220);
    return () => clearTimeout(id);
  }, [input, committed]);

  // Load full results when a query is committed.
  const loadResults = useCallback(async (q: string) => {
    if (!q) {
      setResults(null);
      setSongResults([]);
      return;
    }
    setLoading(true);
    try {
      const [all, songs] = await Promise.all([
        fetch(`/api/search?q=${encodeURIComponent(q)}`).then((r) => (r.ok ? r.json() : null)),
        fetch(`/api/search/songs?q=${encodeURIComponent(q)}`).then((r) => (r.ok ? r.json() : [])),
      ]);
      setResults(all as SearchAllData | null);
      setSongResults((songs as Song[]) || []);
    } catch {
      setResults(null);
      setSongResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadResults(committed);
  }, [committed, loadResults]);

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
      <h1 className="text-h2 font-bold tracking-tight sm:text-h1">Search</h1>

      <div ref={boxRef} className="relative w-full max-w-2xl">
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
            className="w-full rounded-lg bg-white/[0.09] py-2.5 pl-11 pr-4 text-[15px] outline-none transition-colors placeholder:text-text-muted focus:bg-white/[0.14]"
          />
        </form>

        {showSuggest && suggest && input.trim() && (
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
    <div className="glass-panel absolute z-40 mt-2 w-full overflow-hidden rounded-xl2 p-1.5 shadow-lift">
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
}: {
  query: string;
  tab: Tab;
  setTab: (t: Tab) => void;
  results: SearchAllData | null;
  songResults: Song[];
  loading: boolean;
}) {
  const playQueue = usePlayer((s) => s.playQueue);
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

      {!loading && (
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
                      onClick={() => playQueue(songResults, 0)}
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
      className="surface-card group flex flex-col items-center gap-4 p-6 text-center transition-colors hover:bg-surface-raised"
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
          <Link key={r.id} href={resultHref(r)} className="group block">
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
