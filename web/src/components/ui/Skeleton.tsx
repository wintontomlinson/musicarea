/**
 * Loading placeholders. Each mirrors the geometry of the content it replaces so
 * the layout does not shift when real data arrives.
 */

export function Skeleton({
  className = '',
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return <div className={`skeleton ${className}`} style={style} aria-hidden="true" />;
}

export function CardSkeleton() {
  return (
    <div>
      <Skeleton className="aspect-square w-full rounded" />
      <Skeleton className="mt-3 h-3.5 w-4/5" />
      <Skeleton className="mt-2 h-3 w-3/5" />
    </div>
  );
}

export function ShelfSkeleton({ count = 6 }: { count?: number }) {
  return (
    <section aria-hidden="true">
      <Skeleton className="mb-4 h-5 w-44" />
      <div className="flex gap-4 overflow-hidden">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="w-[150px] shrink-0 sm:w-[168px] lg:w-[184px]">
            <CardSkeleton />
          </div>
        ))}
      </div>
    </section>
  );
}

export function TrackListSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-1" aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-2 py-2">
          <Skeleton className="h-4 w-4 rounded-xs" />
          <Skeleton className="h-11 w-11 rounded-sm" />
          <div className="min-w-0 flex-1">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="mt-2 h-3 w-1/4" />
          </div>
          <Skeleton className="hidden h-3 w-24 sm:block" />
          <Skeleton className="h-3 w-8" />
        </div>
      ))}
    </div>
  );
}

export function DetailHeaderSkeleton() {
  return (
    <div className="flex flex-col gap-6 sm:flex-row sm:items-end" aria-hidden="true">
      <Skeleton className="aspect-square w-40 rounded-lg sm:w-52 lg:w-60" />
      <div className="flex-1">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="mt-3 h-9 w-2/3" />
        <Skeleton className="mt-3 h-3.5 w-1/3" />
        <div className="mt-6 flex gap-3">
          <Skeleton className="h-10 w-28 rounded-sm" />
          <Skeleton className="h-10 w-28 rounded-sm" />
        </div>
      </div>
    </div>
  );
}

export function HeroSkeleton() {
  return <Skeleton className="h-[320px] w-full rounded-xl sm:h-[380px]" />;
}
