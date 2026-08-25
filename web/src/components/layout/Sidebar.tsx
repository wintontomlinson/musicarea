'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon, type IconName } from '@/components/ui/Icon';
import { SITE } from '@/lib/config';

interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  match: (path: string) => boolean;
}

const NAV: NavItem[] = [
  { href: '/', label: 'Home', icon: 'home', match: (p) => p === '/' },
  { href: '/search', label: 'Search', icon: 'search', match: (p) => p.startsWith('/search') },
  { href: '/explore', label: 'Explore', icon: 'compass', match: (p) => p.startsWith('/explore') },
  { href: '/library', label: 'Your Library', icon: 'library', match: (p) => p.startsWith('/library') },
];

const SHORTCUTS: NavItem[] = [
  { href: '/liked', label: 'Liked Songs', icon: 'heart', match: (p) => p.startsWith('/liked') },
  { href: '/recent', label: 'Recently Played', icon: 'clock', match: (p) => p.startsWith('/recent') },
  { href: '/charts', label: 'Charts', icon: 'chart', match: (p) => p.startsWith('/charts') },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-60 shrink-0 flex-col gap-2 border-r border-subtle bg-surface/60 p-4 lg:flex">
      <Link href="/" className="mb-4 flex items-center gap-3 px-2" aria-label={`${SITE.name} home`}>
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand shadow-glow">
          <Icon name="play" size={18} className="text-white" />
        </span>
        <span className="flex flex-col leading-tight">
          <span className="text-h5 font-extrabold tracking-tight">{SITE.name}</span>
          <span className="text-[11px] text-text-secondary">{SITE.tagline}</span>
        </span>
      </Link>

      <nav aria-label="Primary" className="flex flex-col gap-1">
        {NAV.map((item) => (
          <NavLink key={item.href} item={item} active={item.match(pathname)} />
        ))}
      </nav>

      <div className="my-3 h-px bg-subtle" />

      <button
        type="button"
        className="flex items-center gap-3 rounded-xl border border-dashed border-accent/50 px-3 py-2.5 text-sm font-semibold text-accent transition-colors duration-150 hover:bg-accent/10"
      >
        <Icon name="plus" size={18} />
        Create Playlist
      </button>

      <nav aria-label="Shortcuts" className="mt-2 flex flex-col gap-1">
        {SHORTCUTS.map((item) => (
          <NavLink key={item.href} item={item} active={item.match(pathname)} />
        ))}
      </nav>

      <div className="mt-auto flex items-center gap-3 rounded-xl border border-subtle p-2.5">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-secondary/40 text-sm font-bold">
          M
        </span>
        <span className="flex-1 text-sm font-semibold">Listener</span>
        <Link href="/settings" aria-label="Settings" className="text-text-secondary hover:text-white">
          <Icon name="gear" size={18} />
        </Link>
      </div>
    </aside>
  );
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={[
        'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-150',
        active
          ? 'bg-brand text-white shadow-lift'
          : 'text-text-secondary hover:bg-white/5 hover:text-white',
      ].join(' ')}
    >
      <Icon name={item.icon} size={20} />
      {item.label}
    </Link>
  );
}
