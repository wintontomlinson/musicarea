import Image from 'next/image';

/**
 * Apple Music's album/playlist header: large artwork on the left, then the
 * title, a red artist/eyebrow line, metadata, and the action pills beneath.
 * Centred on phones, left-aligned from small up, as Apple does.
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
  /** The red line under the title. Albums and songs pass a linked artist name. */
  eyebrow: React.ReactNode;
  title: string;
  meta?: React.ReactNode;
  circular?: boolean;
  actions?: React.ReactNode;
  description?: string;
}) {
  return (
    <header className="flex flex-col items-center gap-6 text-center sm:flex-row sm:items-start sm:text-left">
      <div
        className={`relative aspect-square w-44 shrink-0 overflow-hidden border border-white/15 shadow-[0_22px_50px_-20px_rgb(var(--accent-rgb)/.42)] sm:w-56 lg:w-64 ${
          circular ? 'rounded-full' : 'rounded-xl2'
        }`}
      >
        <Image src={cover} alt={title} fill priority sizes="256px" className="object-cover" />
      </div>

      <div className="min-w-0 flex-1 sm:pt-2">
        <h1 className="text-h3 font-bold tracking-tight sm:text-h2">{title}</h1>
        <p className="mt-1 text-[15px] font-bold text-accent-soft sm:text-h5">{eyebrow}</p>
        {meta && <div className="mt-2 text-[13px] uppercase tracking-wide text-text-secondary">{meta}</div>}
        {actions && <div className="mt-5 flex justify-center gap-3 sm:justify-start">{actions}</div>}
        {description && (
          <p className="mt-4 line-clamp-3 text-[13px] leading-relaxed text-text-secondary">
            {description}
          </p>
        )}
      </div>
    </header>
  );
}
