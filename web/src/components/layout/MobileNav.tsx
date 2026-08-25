'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon, type IconName } from '@/components/ui/Icon';

const ITEMS: Array<{ href: string; label: string; icon: IconName; match: (p: string) => boolean }> = [
  { href: '/', label: 'Home', icon: 'home', match: (p) => p === '/' },
  { href: '/search', label: 'Search', icon: 'search', match: (p) => p.startsWith('/search') },
  { href: '/explore', label: 'Explore', icon: 'compass', match: (p) => p.startsWith('/explore') },
  { href: '/library', label: 'Library', icon: 'library', match: (p) => p.startsWith('/library') },
];

export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-subtle bg-[#121212] pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      {ITEMS.map((item) => {
        const active = item.match(pathname);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={[
              'flex min-h-[58px] flex-col items-center justify-center gap-1 text-[10px] font-bold transition-colors',
              active ? 'text-white' : 'text-text-secondary',
            ].join(' ')}
          >
            <span className={active ? 'grid h-6 w-9 place-items-center rounded-full bg-white/15' : ''}>
              <Icon name={item.icon} size={19} />
            </span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
