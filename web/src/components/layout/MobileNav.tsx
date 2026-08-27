'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { m } from 'motion/react';
import { SPRING_SNAP } from '@/lib/motion';
import { Icon, type IconName } from '@/components/ui/Icon';

/**
 * Height of the bar, in pixels, excluding the safe-area inset.
 *
 * Exported because the player bar sits directly on top of this and has to offset
 * itself by exactly this much. It used to be a `55px` literal duplicated in the
 * mini player's `bottom-[calc(55px+env(safe-area-inset-bottom))]`, which is the
 * kind of coupling that silently breaks the moment the bar's padding changes.
 */
export const MOBILE_NAV_HEIGHT = 56;

const ITEMS: Array<{ href: string; label: string; icon: IconName; match: (path: string) => boolean }> = [
  { href: '/', label: 'Home', icon: 'home', match: (path) => path === '/' },
  { href: '/search', label: 'Search', icon: 'search', match: (path) => path.startsWith('/search') },
  { href: '/explore', label: 'Explore', icon: 'compass', match: (path) => path.startsWith('/explore') },
  { href: '/library', label: 'Library', icon: 'library', match: (path) => path.startsWith('/library') },
  { href: '/profile', label: 'You', icon: 'user', match: (path) => path.startsWith('/profile') },
];

/**
 * Mobile tab bar.
 *
 * The brief specified four tabs (Home, Search, Library, Profile). Explore is kept
 * as a fifth because it is the only mobile entry point to the browse shelves and the
 * charts; dropping it would have made a whole section of the catalogue reachable
 * only from a "See all" link on Home. Five is still within the range where every
 * target stays comfortably wide enough to hit on a small phone.
 *
 * Charts is reached from Explore, and the samples feed from the strip on Home,
 * which is where the design puts its entry point anyway.
 */
export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Main"
      className="chrome-panel fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-white/10 pb-[env(safe-area-inset-bottom)] [--chrome-alpha:0.92] lg:hidden"
    >
      {ITEMS.map((item) => {
        const active = item.match(pathname);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            style={{ minHeight: MOBILE_NAV_HEIGHT }}
            className={`relative flex flex-col items-center justify-center gap-1 text-[10px] font-bold transition-colors ${
              active ? 'text-accent-soft' : 'text-text-muted'
            }`}
          >
            {/* A single indicator shared across tabs via `layoutId`, so it slides
                between them rather than blinking out and in. */}
            {active && (
              <m.span
                layoutId="mobile-nav-indicator"
                transition={SPRING_SNAP}
                className="absolute top-0 h-[2.5px] w-8 rounded-b-full bg-accent"
              />
            )}
            <Icon name={item.icon} size={21} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
