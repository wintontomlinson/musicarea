import { EmptyState } from '@/components/ui/EmptyState';

/**
 * Placeholder for a surface that is deliberately not built yet. Named honestly
 * so it is never mistaken for a working feature.
 */
export function ComingSoon({ page, detail }: { page: string; detail?: string }) {
  return (
    <div className="page page-stack">
      <EmptyState
        icon="alert"
        title={`${page} is not available yet`}
        message={
          detail ??
          'This section is planned but not implemented. Nothing is hidden behind it right now.'
        }
        ctaHref="/"
        ctaLabel="Back to Home"
      />
    </div>
  );
}
