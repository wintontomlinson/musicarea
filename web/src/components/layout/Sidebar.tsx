'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon, type IconName } from '@/components/ui/Icon';
import { SITE } from '@/lib/config';
import { useUser } from '@/stores/user';
import { Avatar } from '@/components/ui/Avatar';

interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  match: (path: string) => boolean;
}

const NAV: NavItem[] = [
  { href: '/', label: 'Home', icon: 'home', match: (path) => path === '/' },
  { href: '/search', label: 'Search', icon: 'search', match: (path) => path.startsWith('/search') },
  { href: '/charts', label: 'Charts', icon: 'chart', match: (path) => path.startsWith('/charts') },
  { href: '/library', label: 'Library', icon: 'library', match: (path) => path.startsWith('/library') },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col px-5 py-6 lg:flex">
      <Link href="/" className="mb-8 flex items-center gap-2" aria-label={`${SITE.name} home`}>
        <Icon name="play" size={17} className="text-accent" />
        <span className="text-lg font-extrabold tracking-tight">{SITE.name}</span>
      </Link>

      <nav aria-label="Primary" className="flex flex-col gap-1">
        {NAV.map((item) => (
          <NavLink key={item.href} item={item} active={item.match(pathname)} />
        ))}
      </nav>

      <ProfileFooter />
    </aside>
  );
}

function ProfileFooter() {
  const profile = useUser((state) => state.profile);
  const name = profile?.name || 'Listener';
  return (
    <Link href="/settings" className="mt-auto flex items-center gap-2 py-2 text-text-secondary hover:text-white">
      <Avatar name={name} avatarId={profile?.avatar ?? 'coral'} size={28} />
      <span className="truncate text-sm font-semibold">{name}</span>
    </Link>
  );
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={[
        'flex items-center gap-3 py-2 text-sm font-semibold transition-colors',
        active ? 'text-white' : 'text-text-secondary hover:text-white',
      ].join(' ')}
    >
      <Icon name={item.icon} size={18} />
      {item.label}
    </Link>
  );
}
