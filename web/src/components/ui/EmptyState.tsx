import Link from 'next/link';

/** A centred state for errors and empty results. */
export function EmptyState({
  title,
  message,
  ctaHref,
  ctaLabel,
}: {
  title: string;
  message: string;
  ctaHref?: string;
  ctaLabel?: string;
}) {
  return (
    <div className="mx-auto my-20 flex max-w-sm flex-col items-center text-center">
      <h2 className="text-h4 font-bold tracking-tight">{title}</h2>
      <p className="mt-2 text-[15px] leading-relaxed text-text-secondary">{message}</p>
      {ctaHref && ctaLabel && (
        <Link href={ctaHref} className="button-primary mt-6">
          {ctaLabel}
        </Link>
      )}
    </div>
  );
}
