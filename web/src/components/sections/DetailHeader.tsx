import Image from 'next/image';

/**
 * Shared header for detail pages (song, album, artist, playlist). A blurred
 * artwork backdrop fades into the page, with the cover, an eyebrow label, the
 * title, a meta line and action slot laid out over it. `circular` renders the
 * artwork as a circle for artists.
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
    <header className="relative overflow-hidden rounded-xl2 border border-subtle">
      <Image src={cover} alt="" fill priority sizes="100vw" className="scale-125 object-cover opacity-30 blur-3xl" />
      <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/70 to-transparent" />

      <div className="relative flex flex-col items-center gap-6 p-6 text-center sm:flex-row sm:items-end sm:p-8 sm:text-left">
        <div
          className={`relative aspect-square w-40 shrink-0 overflow-hidden shadow-lift sm:w-52 ${
            circular ? 'rounded-full' : 'rounded-card'
          }`}
        >
          <Image src={cover} alt={title} fill priority sizes="208px" className="object-cover" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">{eyebrow}</p>
          <h1 className="mt-2 text-h2 font-extrabold tracking-tight sm:text-h1">{title}</h1>
          {description && (
            <p className="mt-2 line-clamp-2 text-sm text-text-secondary">{description}</p>
          )}
          {meta && <div className="mt-2 text-sm text-text-secondary">{meta}</div>}
          {actions && <div className="mt-5 flex justify-center sm:justify-start">{actions}</div>}
        </div>
      </div>
    </header>
  );
}
