import Image from 'next/image';

export function DetailHeader({ cover, eyebrow, title, meta, circular = false, actions, description }: {
  cover: string; eyebrow: string; title: string; meta?: React.ReactNode; circular?: boolean; actions?: React.ReactNode; description?: string;
}) {
  return (
    <header className="premium-panel relative overflow-hidden">
      <Image src={cover} alt="" fill priority sizes="100vw" className="scale-110 object-cover opacity-25 blur-2xl" />
      <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/80 to-bg/25" />
      <div className="relative flex flex-col items-center gap-6 p-6 text-center sm:flex-row sm:items-end sm:p-9 sm:text-left">
        <div className={`relative aspect-square w-40 shrink-0 overflow-hidden shadow-lift sm:w-52 ${circular ? 'rounded-full' : 'rounded-card'}`}>
          <Image src={cover} alt={title} fill priority sizes="208px" className="object-cover" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="mt-2 text-h2 font-extrabold tracking-tight sm:text-h1">{title}</h1>
          {description && <p className="mt-2 line-clamp-2 text-sm text-white/70">{description}</p>}
          {meta && <div className="mt-2 text-sm text-white/75">{meta}</div>}
          {actions && <div className="mt-5 flex justify-center sm:justify-start">{actions}</div>}
        </div>
      </div>
    </header>
  );
}
