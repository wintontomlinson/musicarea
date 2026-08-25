'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon, type IconName } from '@/components/ui/Icon';

const ITEMS: Array<{ href: string; label: string; icon: IconName; match: (path: string) => boolean }> = [
  { href: '/', label: 'Home', icon: 'home', match: (path) => path === '/' },
  { href: '/search', label: 'Search', icon: 'search', match: (path) => path.startsWith('/search') },
  { href: '/charts', label: 'Charts', icon: 'chart', match: (path) => path.startsWith('/charts') },
  { href: '/library', label: 'Library', icon: 'library', match: (path) => path.startsWith('/library') },
];

export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Primary" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-subtle bg-bg pb-[env(safe-area-inset-bottom)] lg:hidden">
      {ITEMS.map((item) => {
        const active = item.match(pathname);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={`flex min-h-[56px] flex-col items-center justify-center gap-1 text-[10px] font-semibold ${
              active ? 'text-white' : 'text-text-secondary'
            }`}
          >
            <Icon name={item.icon} size={18} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
