import Image from 'next/image';

/**
 * Shared header for song, album, artist and playlist pages. Flat neutral
 * surface, artwork on the left, metadata and actions on the right.
 */
export function DetailHeader({
  cover,
  eyebrow,
  title,
  meta,
  circular = false,
  actions,
  description,
}: {
  cover: string;
  eyebrow: string;
  title: string;
  meta?: React.ReactNode;
  circular?: boolean;
  actions?: React.ReactNode;
  description?: string;
}) {
  return (
    <header className="surface-card flex flex-col items-center gap-5 p-5 text-center sm:flex-row sm:items-end sm:p-7 sm:text-left">
      <div
        className={`relative aspect-square w-36 shrink-0 overflow-hidden sm:w-48 ${
          circular ? 'rounded-full' : 'rounded-card'
        }`}
      >
        <Image src={cover} alt={title} fill priority sizes="192px" className="object-cover" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="mt-2 text-h2 font-extrabold tracking-tight sm:text-h1">{title}</h1>
        {description && (
          <p className="mt-2 line-clamp-2 text-sm text-text-secondary">{description}</p>
        )}
        {meta && <div className="mt-2 text-sm text-text-secondary">{meta}</div>}
        {actions && <div className="mt-5 flex justify-center sm:justify-start">{actions}</div>}
      </div>
    </header>
  );
}
