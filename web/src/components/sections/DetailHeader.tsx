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
    <header className="flex flex-col items-center gap-5 text-center sm:flex-row sm:items-end sm:text-left">
      <div className={`relative aspect-square w-36 shrink-0 overflow-hidden sm:w-48 ${circular ? 'rounded-full' : ''}`}>
        <Image src={cover} alt={title} fill priority sizes="192px" className="object-cover" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="mt-1 text-h2 font-extrabold tracking-tight sm:text-h1">{title}</h1>
        {description && <p className="mt-2 line-clamp-2 text-sm text-text-secondary">{description}</p>}
        {meta && <div className="mt-2 text-sm text-text-secondary">{meta}</div>}
        {actions && <div className="mt-5 flex justify-center sm:justify-start">{actions}</div>}
      </div>
    </header>
  );
}
