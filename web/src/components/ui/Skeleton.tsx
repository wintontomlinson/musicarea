/**
 * Loading placeholders.
 *
 * These exist because parts of the redesign fetch on the client (the
 * history-personalised feed, lyrics, search) and an empty region that suddenly
 * fills reads as a glitch. A placeholder of roughly the right shape makes the wait
 * legible and stops the layout jumping when content lands.
 *
 * Every skeleton is `aria-hidden`. A screen reader gains nothing from being told
 * about six grey rectangles; the container that owns the fetch is responsible for
 * announcing its own busy state.
 */

export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`skeleton ${className}`} />;
}

/** Matches the footprint of a `MediaCard`: square art, title, subtitle. */
export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div aria-hidden="true" className={`flex flex-col gap-3 ${className}`}>
      <Skeleton className="aspect-square w-full rounded-card" />
      <Skeleton className="h-3.5 w-4/5 rounded-full" />
      <Skeleton className="h-3 w-1/2 rounded-full" />
    </div>
  );
}

/** Matches a `TrackList` row: index, art, two lines of text, duration. */
export function SkeletonRow() {
  return (
    <div aria-hidden="true" className="flex items-center gap-3 py-2">
      <Skeleton className="h-11 w-11 shrink-0 rounded-[10px]" />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <Skeleton className="h-3.5 w-1/2 rounded-full" />
        <Skeleton className="h-3 w-1/3 rounded-full" />
      </div>
      <Skeleton className="h-3 w-9 shrink-0 rounded-full" />
    </div>
  );
}

/**
 * A horizontal row of card placeholders.
 *
 * The widths mirror `Carousel`'s responsive card widths exactly. If they drift, the
 * real content shifts sideways as it replaces the placeholder, which is worse than
 * having no placeholder at all.
 */
export function SkeletonRail({ count = 6 }: { count?: number }) {
  return (
    <div aria-hidden="true" className="no-scrollbar flex gap-3 overflow-hidden sm:gap-4">
      {Array.from({ length: count }, (_, index) => (
        <SkeletonCard
          key={index}
          className="w-[9.75rem] shrink-0 sm:w-[11rem] lg:w-[12.5rem]"
        />
      ))}
    </div>
  );
}
