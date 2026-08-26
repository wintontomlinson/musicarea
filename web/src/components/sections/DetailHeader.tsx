import Image from 'next/image';

/**
 * Header for an album, playlist or song page.
 *
 * Artwork on the left at a size that lets it be the subject, then a small kind
 * label, the title, a byline, a metadata line and the actions. Centred on
 * phones, left aligned from the small breakpoint up.
 */
export function DetailHeader({
  cover,
  kind,
  title,
  byline,
  meta,
  actions,
  description,
  circular = false,
  priority = true,
}: {
  cover: string;
  /** Small label above the title: Album, Playlist, Song. */
  kind?: string;
  title: string;
  /** Artist or owner line, usually a link. */
  byline?: React.ReactNode;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  description?: string | null;
  circular?: boolean;
  priority?: boolean;
}) {
  return (
    <header className="flex flex-col items-center gap-6 text-center sm:flex-row sm:items-end sm:gap-8 sm:text-left">
      <div
        className={`relative aspect-square w-40 shrink-0 overflow-hidden border border-subtle bg-surface-raised shadow-art sm:w-52 lg:w-[232px] ${
          circular ? 'rounded-full' : 'rounded-lg'
        }`}
      >
        <Image
          src={cover}
          alt={title}
          fill
          priority={priority}
          sizes="(max-width: 640px) 160px, 232px"
          className="object-cover"
        />
      </div>

      <div className="min-w-0 flex-1 pb-1">
        {kind && <p className="t-micro">{kind}</p>}

        <h1 className="mt-2.5 text-title font-bold tracking-[-0.026em] sm:text-[40px] sm:leading-[1.04]">
          {title}
        </h1>

        {byline && <p className="mt-3 text-[15px] font-medium text-text">{byline}</p>}
        {meta && <p className="mt-1.5 text-meta text-text-secondary">{meta}</p>}

        {description && (
          <p className="mt-3.5 max-w-2xl text-meta leading-relaxed text-text-secondary line-clamp-2">
            {description}
          </p>
        )}

        {actions && (
          <div className="mt-6 flex flex-wrap justify-center gap-2.5 sm:justify-start">{actions}</div>
        )}
      </div>
    </header>
  );
}
