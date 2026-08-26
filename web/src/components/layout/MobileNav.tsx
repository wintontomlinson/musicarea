'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon, type IconName } from '@/components/ui/Icon';

const ITEMS: Array<{ href: string; label: string; icon: IconName; match: (path: string) => boolean }> = [
  { href: '/', label: 'Home', icon: 'home', match: (path) => path === '/' },
  { href: '/explore', label: 'Explore', icon: 'compass', match: (path) => path.startsWith('/explore') },
  { href: '/charts', label: 'Charts', icon: 'chart', match: (path) => path.startsWith('/charts') },
  { href: '/library', label: 'Library', icon: 'library', match: (path) => path.startsWith('/library') },
  { href: '/search', label: 'Search', icon: 'search', match: (path) => path.startsWith('/search') },
];

export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Tabs" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-white/10 bg-[#110b20]/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
      {ITEMS.map((item) => {
        const active = item.match(pathname);
        return <Link key={item.href} href={item.href} aria-current={active ? 'page' : undefined} className={`relative flex min-h-[55px] flex-col items-center justify-center gap-1 text-[10px] font-bold transition ${active ? 'text-accent-soft' : 'text-text-muted'}`}>
          {active && <span className="absolute top-0 h-0.5 w-8 rounded-b-full bg-brand" />}
          <Icon name={item.icon} size={21} />
          {item.label}
        </Link>;
      })}
    </nav>
  );
}
