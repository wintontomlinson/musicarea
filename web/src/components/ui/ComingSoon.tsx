import { EmptyState } from '@/components/ui/EmptyState';

export function ComingSoon({ page }: { page: string }) {
  return (
    <div className="app-page">
      <EmptyState
        title={`${page} is on the way`}
        message="This section arrives in a later build phase. The Home feed is live now."
        ctaHref="/"
        ctaLabel="Back to Home"
      />
    </div>
  );
}
