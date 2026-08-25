import Link from 'next/link';

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
    <div className="surface-card mx-auto my-16 flex max-w-md flex-col items-center p-8 text-center">
      <div className="mb-4 h-10 w-10 rounded-full bg-accent/20" />
      <h2 className="section-title">{title}</h2>
      <p className="mt-2 text-sm text-text-secondary">{message}</p>
      {ctaHref && ctaLabel && <Link href={ctaHref} className="button-primary mt-6">{ctaLabel}</Link>}
    </div>
  );
}
