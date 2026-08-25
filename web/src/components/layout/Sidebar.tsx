'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon, type IconName } from '@/components/ui/Icon';
import { AVATARS, SITE } from '@/lib/config';
import { useUser } from '@/stores/user';
import { Avatar } from '@/components/ui/Avatar';

interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  match: (path: string) => boolean;
}

/** Apple Music groups its sidebar: the service, then your library. */
const BROWSE: NavItem[] = [
  { href: '/', label: 'Listen Now', icon: 'home', match: (path) => path === '/' },
  { href: '/explore', label: 'Browse', icon: 'compass', match: (path) => path.startsWith('/explore') },
  { href: '/charts', label: 'Charts', icon: 'chart', match: (path) => path.startsWith('/charts') },
  { href: '/search', label: 'Search', icon: 'search', match: (path) => path.startsWith('/search') },
];

const LIBRARY: NavItem[] = [
  { href: '/recent', label: 'Recently Added', icon: 'clock', match: (path) => path.startsWith('/recent') },
  { href: '/liked', label: 'Favourite Songs', icon: 'heart', match: (path) => path.startsWith('/liked') },
  { href: '/library', label: 'All Music', icon: 'library', match: (path) => path.startsWith('/library') },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-subtle bg-surface/40 px-3 py-4 lg:flex">
      <Link href="/" className="mb-6 flex items-center gap-2 px-2" aria-label={`${SITE.name} home`}>
        <Icon name="play" size={19} className="text-accent" />
        <span className="text-[19px] font-bold tracking-tight">{SITE.name}</span>
      </Link>

      <nav aria-label="Primary" className="flex flex-col gap-0.5">
        {BROWSE.map((item) => (
          <NavLink key={item.href} item={item} active={item.match(pathname)} />
        ))}
      </nav>

      <p className="mb-1.5 mt-7 px-3 text-[12px] font-bold tracking-tight text-text-secondary">
        Library
      </p>
      <nav aria-label="Library" className="flex flex-col gap-0.5">
        {LIBRARY.map((item) => (
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
    <Link
      href="/settings"
      className="mt-auto flex items-center gap-2.5 rounded-md px-2 py-2 transition-colors hover:bg-white/[0.07]"
    >
      <Avatar name={name} avatarId={profile?.avatar ?? AVATARS[0].id} size={26} />
      <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{name}</span>
      <Icon name="gear" size={15} className="text-text-secondary" />
    </Link>
  );
}

/** Apple's sidebar row: red glyph, plain label, grey fill when selected. */
function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={`flex items-center gap-2.5 rounded-md px-3 py-[7px] text-[14px] font-medium transition-colors ${
        active ? 'bg-white/[0.11] text-white' : 'text-white/90 hover:bg-white/[0.06]'
      }`}
    >
      <Icon name={item.icon} size={17} className="shrink-0 text-accent" />
      {item.label}
    </Link>
  );
}
