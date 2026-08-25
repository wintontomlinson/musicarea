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
 * The full search experience. Before typing it shows the mood grid. While
 * typing it shows an instant suggestions dropdown. On submit it shows tabbed
 * results with a Spotify-style Top Result card. The query is mirrored to the
 * URL (?q=) so results are shareable and the browser history works.
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

  // Keep local state in sync when the URL query changes (e.g. via top bar).
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

  // Close the suggestions dropdown on outside click.
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
      {/* Search field with suggestions */}
      <div ref={boxRef} className="relative mx-auto w-full max-w-2xl">
        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            submit(input);
          }}
          className="relative"
        >
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary">
            <Icon name="search" size={20} />
          </span>
          <input
            autoFocus
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onFocus={() => suggest && setShowSuggest(true)}
            placeholder="Songs, artists, albums, playlists"
            aria-label="Search"
            className="w-full rounded-full border border-subtle bg-surface-raised/90 py-3.5 pl-12 pr-4 text-base outline-none shadow-lift transition-colors placeholder:text-text-muted focus:border-accent/60"
          />
        </form>

        {showSuggest && suggest && input.trim() && (
          <SuggestDropdown data={suggest} onPick={() => setShowSuggest(false)} />
        )}
      </div>

      {/* Before typing: mood grid. After: results. */}
      {!committed ? (
        <MoodGrid moods={moods} heading="Browse by mood" />
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

/** Instant suggestions grouped by type, with a highlighted top result. */
function SuggestDropdown({ data, onPick }: { data: SearchAllData; onPick: () => void }) {
  const top = data.topQuery?.results?.[0];
  const songs = data.songs?.results?.slice(0, 4) ?? [];
  const artists = data.artists?.results?.slice(0, 3) ?? [];

  if (!top && !songs.length && !artists.length) return null;

  return (
    <div className="glass-panel absolute z-40 mt-2 w-full overflow-hidden rounded-xl2 p-2 shadow-lift">
      {top && (
        <Link
          href={resultHref(top)}
          onClick={onPick}
          className="flex items-center gap-3 rounded-lg p-2 hover:bg-white/5"
        >
          <span className="relative h-11 w-11 overflow-hidden rounded">
            <Image src={resultImage(top)} alt="" fill sizes="44px" className="object-cover" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">{decodeEntities(top.title)}</span>
            <span className="block truncate text-xs text-text-secondary">{resultSubtitle(top)}</span>
          </span>
        </Link>
      )}
      {[...songs, ...artists].map((r) => (
        <Link
          key={`${r.type}-${r.id}`}
          href={resultHref(r)}
          onClick={onPick}
          className="flex items-center gap-3 rounded-lg p-2 hover:bg-white/5"
        >
          <span className={`relative h-9 w-9 overflow-hidden ${r.type === 'artist' ? 'rounded-full' : 'rounded'}`}>
            <Image src={resultImage(r)} alt="" fill sizes="36px" className="object-cover" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm">{decodeEntities(r.title)}</span>
            <span className="block truncate text-xs text-text-secondary">{resultSubtitle(r)}</span>
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
      {/* Tabs */}
      <div role="tablist" className="mb-6 flex gap-2 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold capitalize transition-colors duration-150 ${
              tab === t ? 'bg-brand text-white shadow-glow' : 'border border-subtle bg-white/5 text-text-secondary hover:bg-white/10 hover:text-white'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {loading && <p className="text-sm text-text-secondary">Searching for “{query}”…</p>}

      {!loading && (
        <div className="flex flex-col gap-10">
          {(tab === 'all' || tab === 'songs') && (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,320px)_1fr]">
              {tab === 'all' && top && (
                <div>
                  <h2 className="mb-3 text-h5 font-bold">Top Result</h2>
                  <TopResultCard result={top} />
                </div>
              )}
              <div className={tab === 'all' ? '' : 'lg:col-span-2'}>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-h5 font-bold">Songs</h2>
                  {songResults.length > 0 && (
                    <button
                      type="button"
                      onClick={() => playQueue(songResults, 0)}
                      className="text-sm font-semibold text-accent hover:text-accent-soft"
                    >
                      Play all
                    </button>
                  )}
                </div>
                {songResults.length ? (
                  <TrackList songs={songResults.slice(0, tab === 'all' ? 6 : 30)} />
                ) : (
                  <p className="text-sm text-text-secondary">No songs found.</p>
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
      className="premium-panel group block p-5 transition-colors hover:bg-surface-raised"
    >
      <span
        className={`relative mb-4 block h-24 w-24 overflow-hidden shadow-lift ${
          result.type === 'artist' ? 'rounded-full' : 'rounded-card'
        }`}
      >
        <Image src={resultImage(result)} alt="" fill sizes="96px" className="object-cover" />
      </span>
      <p className="truncate text-h4 font-extrabold">{decodeEntities(result.title)}</p>
      <p className="mt-1 text-sm text-text-secondary">{resultSubtitle(result)}</p>
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
      <h2 className="mb-3 text-h5 font-bold">{title}</h2>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {items.map((r) => (
          <Link key={r.id} href={resultHref(r)} className="group rounded-card p-2 transition-colors hover:bg-white/5">
            <span
              className={`relative mb-3 block aspect-square overflow-hidden ${
                circular ? 'rounded-full' : 'rounded-card'
              }`}
            >
              <Image
                src={resultImage(r)}
                alt=""
                fill
                sizes="200px"
                className="object-cover transition-transform duration-300 group-hover:scale-105"
              />
            </span>
            <p className={`truncate text-sm font-semibold ${circular ? 'text-center' : ''}`}>
              {decodeEntities(r.title)}
            </p>
            <p className={`truncate text-xs text-text-secondary ${circular ? 'text-center' : ''}`}>
              {resultSubtitle(r)}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}
