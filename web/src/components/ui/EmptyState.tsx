import Link from 'next/link';

/** A friendly full-width state for errors and empty results. */
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
    <div className="glass mx-auto my-16 flex max-w-md flex-col items-center rounded-xl2 p-10 text-center">
      <div className="mb-4 h-14 w-14 rounded-full bg-brand-soft" />
      <h2 className="text-h4 font-extrabold">{title}</h2>
      <p className="mt-2 text-sm text-text-secondary">{message}</p>
      {ctaHref && ctaLabel && (
        <Link
          href={ctaHref}
          className="mt-6 rounded-full bg-brand px-6 py-2.5 text-sm font-bold text-white shadow-glow"
        >
          {ctaLabel}
        </Link>
      )}
    </div>
  );
}
