import Link from 'next/link';
import { Icon, type IconName } from '@/components/ui/Icon';

/**
 * Empty and error state. One quiet glyph, a plain sentence and at most two
 * actions. No illustrations, because a stock drawing would date the product and
 * say nothing the copy does not.
 */
export function EmptyState({
  icon = 'musicOff',
  title,
  message,
  ctaHref,
  ctaLabel,
  secondaryHref,
  secondaryLabel,
  onRetry,
  compact = false,
}: {
  icon?: IconName;
  title: string;
  message?: string;
  ctaHref?: string;
  ctaLabel?: string;
  secondaryHref?: string;
  secondaryLabel?: string;
  onRetry?: () => void;
  compact?: boolean;
}) {
  return (
    <div
      className={`mx-auto flex max-w-md flex-col items-center text-center ${
        compact ? 'py-12' : 'py-20'
      }`}
    >
      <span className="grid h-11 w-11 place-items-center rounded-full border border-subtle bg-white/5 text-text-muted">
        <Icon name={icon} size={20} />
      </span>
      <h2 className="mt-5 text-section">{title}</h2>
      {message && <p className="mt-2 text-body leading-relaxed text-text-secondary">{message}</p>}

      {(ctaHref || onRetry || secondaryHref) && (
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          {onRetry && (
            <button type="button" onClick={onRetry} className="btn-primary">
              <Icon name="refresh" size={16} />
              Try again
            </button>
          )}
          {ctaHref && ctaLabel && (
            <Link href={ctaHref} className={onRetry ? 'btn-secondary' : 'btn-primary'}>
              {ctaLabel}
            </Link>
          )}
          {secondaryHref && secondaryLabel && (
            <Link href={secondaryHref} className="btn-secondary">
              {secondaryLabel}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
