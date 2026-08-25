import { EmptyState } from '@/components/ui/EmptyState';

/** Placeholder for routes delivered in later phases. */
export function ComingSoon({ page }: { page: string }) {
  return (
    <div className="px-4 sm:px-6">
      <EmptyState
        title={`${page} is on the way`}
        message="This section arrives in a later build phase. The home feed is live now."
        ctaHref="/"
        ctaLabel="Back to Home"
      />
    </div>
  );
}
