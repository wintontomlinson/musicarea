'use client';

import { useEffect, useMemo, useState } from 'react';
import type { FeedData, Mood, Row, Song } from '@/lib/types';
import { useLibrary } from '@/stores/library';
import { buildHistory, isColdStart } from '@/lib/history';
import { isSong } from '@/lib/utils';
import { Carousel } from '@/components/sections/Carousel';
import { MoodGrid } from '@/components/sections/MoodGrid';
import { SkeletonRail } from '@/components/ui/Skeleton';
import { GreetingHeader } from '@/components/home/GreetingHeader';
import { MoodChips } from '@/components/home/MoodChips';
import { RadioCard } from '@/components/home/RadioCard';
import { QuickPicks } from '@/components/home/QuickPicks';
import { RecentGrid } from '@/components/home/RecentGrid';
import { SmartPlaylistCards } from '@/components/home/SmartPlaylistCards';

interface HomeExperienceProps {
  /** Editorial rows from the server. Always shown, never personalised. */
  browseRows: Row[];
  /** Cold-start feed rows from the server, used until the client feed arrives. */
  initialFeedRows: Row[];
  moods: Mood[];
  languages: string[];
}

/**
 * Home, assembled on the client so it can be personalised.
 *
 * The problem this solves: the server cannot personalise this page. The listener's
 * history lives in localStorage, so a server render has no access to it, and the page
 * was calling the feed endpoint with `history: []`. That meant the recommender ran its
 * cold-start path on every visit for every listener, no matter how much they had
 * played, and the "for you" rows were the same generic shelves for everybody.
 *
 * So the page renders in two passes. The server produces real, indexable content
 * immediately (editorial rows plus a cold feed), and once the library has hydrated this
 * component re-requests the feed with actual history and swaps the personalised rows in.
 * The important part is that the first pass is not a skeleton: nothing moves when the
 * second pass lands except the rows that genuinely got better.
 */
export function HomeExperience({
  browseRows,
  initialFeedRows,
  moods,
  languages,
}: HomeExperienceProps) {
  const hydrate = useLibrary((state) => state.hydrate);
  const hydrated = useLibrary((state) => state.hydrated);
  const recent = useLibrary((state) => state.recent);
  const liked = useLibrary((state) => state.liked);
  const playedAt = useLibrary((state) => state.playedAt);
  const likedAt = useLibrary((state) => state.likedAt);

  const [mood, setMood] = useState<string | null>(null);
  /**
   * The settled result of the last feed request, tagged with the request it answers.
   *
   * Only the outcome is stored. Loading state and the choice of which rows to render are
   * both derived below, because keeping them as separate state would mean setting state
   * synchronously inside the effect (a cascading render) and would leave several fields
   * that have to be kept consistent with each other by hand.
   */
  const [result, setResult] = useState<{ key: string; rows: Row[] } | null>(null);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const history = useMemo(
    () => (hydrated ? buildHistory({ recent, liked, playedAt, likedAt }) : []),
    [hydrated, recent, liked, playedAt, likedAt],
  );

  // A stable fingerprint of the request, so the effect below re-runs when the history
  // meaningfully changes but not on every unrelated library write. Depending on the
  // `history` array itself would refetch the entire feed each time a song was liked,
  // which is a request per heart tap.
  const historyKey = useMemo(
    () => `${history.length}:${history[history.length - 1]?.id ?? ''}`,
    [history],
  );

  /** Identifies the request the current inputs call for. */
  const requestKey = `${historyKey}|${mood ?? ''}`;
  /**
   * With too little history and no mood applied, the server's cold-start rows are already
   * the right answer, so no request is made at all.
   */
  const skipRequest = isColdStart(history) && !mood;
  const answered = result?.key === requestKey;
  const shouldFetch = hydrated && !skipRequest && !answered;

  // An empty `rows` is how a failed or empty response is recorded, so this falls back to
  // the server's rows in both cases. A failed personalisation attempt stays invisible:
  // the listener still has a working home page and never asked for the request.
  const feedRows = answered && result.rows.length ? result.rows : initialFeedRows;
  const personalised = answered && result.rows.length > 0 && !isColdStart(history);
  const loadingFeed = shouldFetch;

  useEffect(() => {
    if (!shouldFetch) return;

    // Cleanup aborts, which is what prevents an out-of-order response from overwriting a
    // newer one: changing mood changes `requestKey`, which re-runs this effect, which
    // aborts the in-flight request so its success path never fires. Rapidly tapping
    // between moods is exactly the case that would otherwise land results out of order.
    const controller = new AbortController();

    fetch('/api/feed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ history, languages, limit: 14, mood: mood ?? undefined }),
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error('feed failed');
        return res.json() as Promise<FeedData>;
      })
      .then((data) => {
        setResult({ key: requestKey, rows: (data.rows ?? []).filter((row) => row.items?.length) });
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return;
        // Recorded as answered-with-nothing rather than left unanswered, otherwise
        // `shouldFetch` would stay true and the skeleton would never clear.
        setResult({ key: requestKey, rows: [] });
      });

    return () => controller.abort();
  }, [shouldFetch, requestKey, history, languages, mood]);

  // Quick Picks is drawn from the personalised song rows, which is what makes it
  // "quick picks for you" rather than a second trending shelf. Falls back to editorial
  // songs when there is no history yet.
  const pickSource = feedRows.length ? feedRows : browseRows;
  const quickPicks = useMemo(() => collectSongs(pickSource, 20), [pickSource]);

  // The station seeds from the last thing played, which is the strongest available
  // signal of what the listener wants more of right now. With no history it falls back
  // to the top recommended track.
  const radioSeed = hydrated ? (recent[0] ?? quickPicks[0]) : undefined;

  // Song rows are already represented by Quick Picks, so rendering them again as
  // carousels would show the same twenty tracks twice on one screen.
  const feedCollectionRows = feedRows.filter((row) => row.kind !== 'songs');

  return (
    <div className="app-page">
      <GreetingHeader />

      <MoodChips moods={moods} active={mood} onChange={setMood} />

      {radioSeed && <RadioCard seed={radioSeed} />}

      {loadingFeed && quickPicks.length === 0 ? (
        <section>
          <div className="mb-4 h-6 w-40 skeleton rounded-full" />
          <SkeletonRail />
        </section>
      ) : (
        <QuickPicks
          songs={quickPicks}
          title={mood ? `${moodName(moods, mood)} picks` : 'Quick picks'}
          subtitle={
            personalised
              ? 'Ranked from your listening history on this device'
              : 'Popular in the languages you follow'
          }
        />
      )}

      {hydrated && <RecentGrid songs={recent} />}

      {hydrated && <SmartPlaylistCards history={history} />}

      {feedCollectionRows.map((row) => (
        <Carousel key={`feed-${row.id}-${row.title}`} row={row} />
      ))}

      {browseRows.map((row) => (
        <Carousel key={`browse-${row.id}-${row.title}`} row={row} />
      ))}

      <MoodGrid moods={moods} heading="Browse every mood" />
    </div>
  );
}

function moodName(moods: Mood[], id: string): string {
  return moods.find((mood) => mood.id === id)?.name ?? 'Mood';
}

/** Flatten song rows into one de-duplicated list. */
function collectSongs(rows: Row[], limit: number): Song[] {
  const out: Song[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (row.kind !== 'songs') continue;
    for (const item of row.items) {
      // The same track legitimately appears in more than one row (trending and just
      // released overlap constantly), and a duplicate in Quick Picks would also break
      // the `findIndex` used to start playback from the right position.
      if (!isSong(item) || seen.has(item.id)) continue;
      seen.add(item.id);
      out.push(item);
      if (out.length >= limit) return out;
    }
  }
  return out;
}
