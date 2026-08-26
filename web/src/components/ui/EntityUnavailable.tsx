import { EmptyState } from '@/components/ui/EmptyState';

/**
 * Shown when a detail page could not reach the catalogue. Deliberately does not
 * claim the entity is missing, and is marked `noindex` by the page that renders
 * it so an outage cannot cost real URLs their place in the index.
 */
export function EntityUnavailable({ kind }: { kind: string }) {
  return (
    <div className="app-page">
      <EmptyState
        title={`This ${kind} could not be loaded`}
        message="The music catalogue is not responding right now. The page is fine, so please try again in a moment."
        ctaHref="/"
        ctaLabel="Back to Home"
      />
    </div>
  );
}

/**
 * Metadata for that state. `noindex` keeps a temporary outage from being
 * crawled, and the title says "unavailable" rather than "not found".
 */
export function unavailableMetadata(kind: string) {
  return {
    title: `${kind.charAt(0).toUpperCase()}${kind.slice(1)} temporarily unavailable`,
    robots: { index: false, follow: true },
  };
}
