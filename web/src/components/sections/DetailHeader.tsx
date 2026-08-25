import Image from 'next/image';

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
    <header className="surface-card relative overflow-hidden bg-surface-raised">
      <Image src={cover} alt="" fill priority sizes="100vw" className="object-cover opacity-15" />
      <div className="absolute inset-0 bg-black/65" />

      <div className="relative flex flex-col items-center gap-5 p-5 text-center sm:flex-row sm:items-end sm:p-8 sm:text-left">
        <div
          className={`relative aspect-square w-36 shrink-0 overflow-hidden shadow-lift sm:w-48 ${
            circular ? 'rounded-full' : 'rounded-card'
          }`}
        >
          <Image src={cover} alt={title} fill priority sizes="192px" className="object-cover" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="mt-2 text-h2 font-extrabold tracking-tight sm:text-h1">{title}</h1>
          {description && <p className="mt-2 line-clamp-2 text-sm text-white/65">{description}</p>}
          {meta && <div className="mt-2 text-sm text-white/70">{meta}</div>}
          {actions && <div className="mt-5 flex justify-center sm:justify-start">{actions}</div>}
        </div>
      </div>
    </header>
  );
}
