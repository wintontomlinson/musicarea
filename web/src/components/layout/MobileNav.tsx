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

/** Bottom tab bar for phones and small tablets. Hidden from lg up. */
export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-subtle bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-glass lg:hidden"
    >
      {ITEMS.map((item) => {
        const active = item.match(pathname);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={[
              'flex min-h-[56px] flex-col items-center justify-center gap-1 text-[10px] font-bold transition-colors duration-150',
              active ? 'text-accent' : 'text-text-secondary',
            ].join(' ')}
          >
            <Icon name={item.icon} size={20} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
