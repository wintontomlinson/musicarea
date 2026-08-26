'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import type { Mood, SearchAllData, SearchResult, Song } from '@/lib/types';
import { MoodGrid } from '@/components/sections/MoodGrid';
import { TrackList } from '@/components/sections/TrackList';
import { Icon } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/EmptyState';
import { CardSkeleton, Skeleton, TrackListSkeleton } from '@/components/ui/Skeleton';
import { usePlayer } from '@/stores/player';
import { decodeEntities, resultHref, resultImage, resultSubtitle } from './resultHelpers';

type Tab = 'all' | 'songs' | 'artists' | 'albums' | 'playlists' | 'genres';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'all', label: 'Top results' },
  { id: 'songs', label: 'Songs' },
  { id: 'artists', label: 'Artists' },
  { id: 'albums', label: 'Albums' },
  { id: 'playlists', label: 'Playlists' },
  { id: 'genres', label: 'Genres' },
];

type Status = 'idle' | 'loading' | 'ready' | 'error';

/**
 * Search.
 *
 * The field is the page's primary control. Typing produces a debounced
 * suggestion list that is fully keyboard navigable; committing a query loads
 * full results in parallel and mirrors the term into the URL so a result set can
 * be shared or reached with the back button.
 *
 * Every network call is abortable, so a fast typist never sees results from a
 * query they have already replaced.
 */
export function SearchExperience({
  moods,
  initialQuery,
}: {
  moods: Mood[];
  initialQuery: string;
}) {
  const router = useRouter();
  const params = useSearchParams();

  const [input, setInput] = useState(initialQuery);
  const [committed, setCommitted] = useState(initialQuery);
  const [tab, setTab] = useState<Tab>('all');

  const [suggestions, setSuggestions] = useState<SearchResult[]>([]);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);

  const [results, setResults] = useState<SearchAllData | null>(null);
  const [songs, setSongs] = useState<Song[]>([]);
  const [status, setStatus] = useState<Status>(initialQuery ? 'loading' : 'idle');

  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestAbort = useRef<AbortController | null>(null);
  const resultsAbort = useRef<AbortController | null>(null);

  // Keep in step with the URL, which the header search also writes to.
  useEffect(() => {
    const next = params.get('q') ?? '';
    setInput(next);
    setCommitted(next);
  }, [params]);

  // Debounced suggestions. Skipped once the term has been committed, because the
  // full results below already answer the question.
  useEffect(() => {
    const term = input.trim();
    if (!term || term === committed) {
      setSuggestions([]);
      setSuggestOpen(false);
      return;
    }

    const timer = window.setTimeout(async () => {
      suggestAbort.current?.abort();
      const controller = new AbortController();
      suggestAbort.current = controller;

      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`, {
          signal: controller.signal,
        });
        if (!res.ok) return;
        const data = (await res.json()) as SearchAllData;
        const merged = [
          ...(data.topQuery?.results ?? []).slice(0, 1),
          ...(data.songs?.results ?? []).slice(0, 4),
          ...(data.artists?.results ?? []).slice(0, 2),
          ...(data.albums?.results ?? []).slice(0, 2),
        ];
        // De-duplicate: the top query is usually also present in its own bucket.
        const seen = new Set<string>();
        setSuggestions(
          merged.filter((entry) => {
            const key = `${entry.type}-${entry.id}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          }),
        );
        setSuggestOpen(true);
        setActiveSuggestion(-1);
      } catch {
        /* aborted or offline: the field stays usable, no suggestion noise */
      }
    }, 220);

    return () => window.clearTimeout(timer);
  }, [input, committed]);

  const loadResults = useCallback(async (term: string) => {
    resultsAbort.current?.abort();

    if (!term) {
      setResults(null);
      setSongs([]);
      setStatus('idle');
      return;
    }

    const controller = new AbortController();
    resultsAbort.current = controller;
    setStatus('loading');

    try {
      const [allRes, songRes] = await Promise.all([
        fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: controller.signal }),
        fetch(`/api/search/songs?q=${encodeURIComponent(term)}`, { signal: controller.signal }),
      ]);

      if (!allRes.ok && !songRes.ok) {
        setStatus('error');
        return;
      }

      setResults(allRes.ok ? ((await allRes.json()) as SearchAllData) : null);
      setSongs(songRes.ok ? ((await songRes.json()) as Song[]) ?? [] : []);
      setStatus('ready');
    } catch (error) {
      if ((error as Error).name === 'AbortError') return;
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    void loadResults(committed);
    return () => resultsAbort.current?.abort();
  }, [committed, loadResults]);

  // Dismiss the suggestion list on an outside click.
  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(event.target as Node)) setSuggestOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  function commit(term: string) {
    const trimmed = term.trim();
    setSuggestOpen(false);
    setActiveSuggestion(-1);
    setCommitted(trimmed);
    router.replace(trimmed ? `/search?q=${encodeURIComponent(trimmed)}` : '/search', {
      scroll: false,
    });
  }

  function onFieldKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!suggestOpen || suggestions.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveSuggestion((index) => (index + 1) % suggestions.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveSuggestion((index) => (index <= 0 ? suggestions.length - 1 : index - 1));
    } else if (event.key === 'Enter' && activeSuggestion >= 0) {
      event.preventDefault();
      const picked = suggestions[activeSuggestion];
      setSuggestOpen(false);
      router.push(resultHref(picked));
    } else if (event.key === 'Escape') {
      setSuggestOpen(false);
      setActiveSuggestion(-1);
    }
  }

  function clearField() {
    setInput('');
    commit('');
    inputRef.current?.focus();
  }

  return (
    <div className="page page-stack">
      <header>
        <h1 className="t-display">Search</h1>
      </header>

      <div ref={boxRef} className="relative -mt-6 w-full max-w-2xl">
        <form
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            commit(input);
          }}
        >
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-text-muted">
              <Icon name="search" size={19} />
            </span>
            <input
              ref={inputRef}
              type="search"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onFocus={() => suggestions.length > 0 && setSuggestOpen(true)}
              onKeyDown={onFieldKeyDown}
              placeholder="Songs, artists, albums, playlists"
              aria-label="Search music"
              autoComplete="off"
              role="combobox"
              aria-expanded={suggestOpen}
              aria-controls="search-suggestions"
              aria-autocomplete="list"
              aria-activedescendant={
                activeSuggestion >= 0 ? `suggestion-${activeSuggestion}` : undefined
              }
              className="field py-3.5 pl-12 pr-11 text-[15px]"
            />
            {input && (
              <button
                type="button"
                onClick={clearField}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 btn-icon h-8 w-8"
              >
                <Icon name="close" size={16} />
              </button>
            )}
          </div>
        </form>

        {suggestOpen && suggestions.length > 0 && (
          <ul
            id="search-suggestions"
            role="listbox"
            aria-label="Search suggestions"
            className="surface-pop absolute z-40 mt-2 w-full animate-fade-in overflow-hidden p-1.5"
          >
            {suggestions.map((entry, index) => (
              <li key={`${entry.type}-${entry.id}`} role="none">
                <Link
                  id={`suggestion-${index}`}
                  role="option"
                  aria-selected={index === activeSuggestion}
                  href={resultHref(entry)}
                  onClick={() => setSuggestOpen(false)}
                  onMouseEnter={() => setActiveSuggestion(index)}
                  className={`flex items-center gap-3 rounded-xs p-2 transition-colors duration-fast ${
                    index === activeSuggestion ? 'bg-white/[0.09]' : 'hover:bg-white/5'
                  }`}
                >
                  <span
                    className={`relative h-10 w-10 shrink-0 overflow-hidden bg-surface ${
                      entry.type === 'artist' ? 'rounded-full' : 'rounded-sm'
                    }`}
                  >
                    <Image
                      src={resultImage(entry)}
                      alt=""
                      fill
                      sizes="40px"
                      className="object-cover"
                    />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-body font-medium">
                      {decodeEntities(entry.title)}
                    </span>
                    <span className="block truncate text-meta text-text-secondary">
                      {resultSubtitle(entry)}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {!committed ? (
        <MoodGrid moods={moods} heading="Browse genres" headingId="search-genres" />
      ) : (
        <SearchResults
          query={committed}
          status={status}
          tab={tab}
          onTab={setTab}
          results={results}
          songs={songs}
          moods={moods}
          onRetry={() => void loadResults(committed)}
        />
      )}
    </div>
  );
}

function SearchResults({
  query,
  status,
  tab,
  onTab,
  results,
  songs,
  moods,
  onRetry,
}: {
  query: string;
  status: Status;
  tab: Tab;
  onTab: (tab: Tab) => void;
  results: SearchAllData | null;
  songs: Song[];
  moods: Mood[];
  onRetry: () => void;
}) {
  const playQueue = usePlayer((s) => s.playQueue);

  const topResult = results?.topQuery?.results?.[0];
  const artists = results?.artists?.results ?? [];
  const albums = results?.albums?.results ?? [];
  const playlists = results?.playlists?.results ?? [];

  const nothingFound = useMemo(
    () =>
      status === 'ready' &&
      !topResult &&
      songs.length === 0 &&
      artists.length === 0 &&
      albums.length === 0 &&
      playlists.length === 0,
    [status, topResult, songs.length, artists.length, albums.length, playlists.length],
  );

  if (status === 'error') {
    return (
      <EmptyState
        icon="wifiOff"
        title="Search failed"
        message="We could not reach the catalogue. Check your connection and try again."
        onRetry={onRetry}
      />
    );
  }

  return (
    <div>
      <div role="tablist" aria-label="Result categories" className="bleed-row no-scrollbar mb-8 pb-1">
        {TABS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            role="tab"
            aria-selected={tab === entry.id}
            onClick={() => onTab(entry.id)}
            className={`chip shrink-0 snap-start ${tab === entry.id ? 'chip-active' : ''}`}
          >
            {entry.label}
          </button>
        ))}
      </div>

      {status === 'loading' && (
        <div className="flex flex-col gap-10">
          <div>
            <Skeleton className="mb-4 h-5 w-32" />
            <TrackListSkeleton rows={6} />
          </div>
          <div>
            <Skeleton className="mb-4 h-5 w-28" />
            <div className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 lg:grid-cols-5">
              {Array.from({ length: 5 }).map((_, index) => (
                <CardSkeleton key={index} />
              ))}
            </div>
          </div>
        </div>
      )}

      {nothingFound && (
        <EmptyState
          icon="search"
          title={`No results for "${query}"`}
          message="Check the spelling, or try an artist or album name instead."
        />
      )}

      {status === 'ready' && !nothingFound && (
        <div className="flex flex-col gap-11">
          {tab === 'genres' ? (
            <MoodGrid moods={moods} heading="Genres" headingId="results-genres" />
          ) : (
            <>
              {(tab === 'all' || tab === 'songs') && (
                <div className="grid gap-9 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
                  {tab === 'all' && topResult && (
                    <section aria-labelledby="top-result">
                      <h2 id="top-result" className="mb-4 text-section">
                        Top result
                      </h2>
                      <TopResultCard result={topResult} />
                    </section>
                  )}

                  <section
                    aria-labelledby="result-songs"
                    className={tab === 'all' ? '' : 'lg:col-span-2'}
                  >
                    <div className="mb-4 flex items-center justify-between gap-4">
                      <h2 id="result-songs" className="text-section">
                        Songs
                      </h2>
                      {songs.length > 0 && (
                        <button
                          type="button"
                          onClick={() => playQueue(songs, 0)}
                          className="link-quiet"
                        >
                          <Icon name="play" size={13} />
                          Play all
                        </button>
                      )}
                    </div>

                    {songs.length ? (
                      <TrackList songs={songs.slice(0, tab === 'all' ? 6 : 40)} />
                    ) : (
                      <p className="t-meta">No songs matched this search.</p>
                    )}
                  </section>
                </div>
              )}

              {(tab === 'all' || tab === 'artists') && artists.length > 0 && (
                <ResultGrid id="artists" title="Artists" items={artists} circular />
              )}
              {(tab === 'all' || tab === 'albums') && albums.length > 0 && (
                <ResultGrid id="albums" title="Albums" items={albums} />
              )}
              {(tab === 'all' || tab === 'playlists') && playlists.length > 0 && (
                <ResultGrid id="playlists" title="Playlists" items={playlists} />
              )}
            </>
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
      className="surface group flex flex-col gap-4 p-5 transition-colors duration-fast hover:bg-surface-raised"
    >
      <span
        className={`relative block h-24 w-24 overflow-hidden bg-surface-raised shadow-art ${
          result.type === 'artist' ? 'rounded-full' : 'rounded'
        }`}
      >
        <Image src={resultImage(result)} alt="" fill sizes="96px" className="object-cover" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[19px] font-semibold group-hover:underline">
          {decodeEntities(result.title)}
        </span>
        <span className="mt-1 block truncate text-meta text-text-secondary">
          {resultSubtitle(result)}
        </span>
      </span>
    </Link>
  );
}

function ResultGrid({
  id,
  title,
  items,
  circular = false,
}: {
  id: string;
  title: string;
  items: SearchResult[];
  circular?: boolean;
}) {
  return (
    <section aria-labelledby={`results-${id}`}>
      <h2 id={`results-${id}`} className="mb-4 text-section">
        {title}
      </h2>
      <div className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
        {items.map((entry) => (
          <Link key={entry.id} href={resultHref(entry)} className="group block">
            <span
              className={`relative mb-3 block aspect-square overflow-hidden bg-surface-raised shadow-art ${
                circular ? 'rounded-full' : 'rounded'
              }`}
            >
              <Image
                src={resultImage(entry)}
                alt=""
                fill
                sizes="(max-width: 640px) 45vw, 200px"
                className="object-cover transition-transform duration-base ease-out group-hover:scale-[1.03]"
              />
            </span>
            <p
              className={`truncate text-body font-semibold group-hover:underline ${
                circular ? 'text-center' : ''
              }`}
            >
              {decodeEntities(entry.title)}
            </p>
            <p
              className={`mt-1 truncate text-meta text-text-secondary ${
                circular ? 'text-center' : ''
              }`}
            >
              {resultSubtitle(entry)}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}
