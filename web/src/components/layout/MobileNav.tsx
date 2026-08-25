'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon, type IconName } from '@/components/ui/Icon';

/** The five tabs Apple Music uses on iPhone, mapped to this app's routes. */
const ITEMS: Array<{ href: string; label: string; icon: IconName; match: (path: string) => boolean }> = [
  { href: '/', label: 'Listen Now', icon: 'home', match: (path) => path === '/' },
  { href: '/explore', label: 'Browse', icon: 'compass', match: (path) => path.startsWith('/explore') },
  { href: '/charts', label: 'Charts', icon: 'chart', match: (path) => path.startsWith('/charts') },
  { href: '/library', label: 'Library', icon: 'library', match: (path) => path.startsWith('/library') },
  { href: '/search', label: 'Search', icon: 'search', match: (path) => path.startsWith('/search') },
];

/** Translucent iOS tab bar. Hidden from lg up, where the sidebar takes over. */
export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav
      // A distinct landmark name: the sidebar already owns "Primary", and both
      // are present in the DOM even though only one shows per breakpoint.
      aria-label="Tabs"
      className="glass-panel fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-x-0 border-b-0 pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      {ITEMS.map((item) => {
        const active = item.match(pathname);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={`flex min-h-[50px] flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors ${
              active ? 'text-accent' : 'text-text-secondary'
            }`}
          >
            <Icon name={item.icon} size={22} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
