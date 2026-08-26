'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon, type IconName } from '@/components/ui/Icon';

const TABS: Array<{ href: string; label: string; icon: IconName; exact?: boolean }> = [
  { href: '/', label: 'Home', icon: 'home', exact: true },
  { href: '/search', label: 'Search', icon: 'search' },
  { href: '/library', label: 'Library', icon: 'library' },
  { href: '/settings', label: 'Profile', icon: 'user' },
];

/**
 * Mobile tab bar. Four destinations, comfortable touch targets, and safe-area
 * padding so the row clears a home indicator. Hidden from the large breakpoint
 * up, where the sidebar takes over.
 */
export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Tabs"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-subtle bg-bg-alt pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <div className="grid grid-cols-4">
        {TABS.map((tab) => {
          const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? 'page' : undefined}
              className={`flex h-tabbar flex-col items-center justify-center gap-1 text-micro font-medium transition-colors duration-fast ${
                active ? 'text-text' : 'text-text-muted'
              }`}
            >
              <Icon name={tab.icon} size={21} className={active ? 'text-accent' : undefined} />
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
