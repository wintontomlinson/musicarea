'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon, type IconName } from '@/components/ui/Icon';
import { AVATARS, SITE } from '@/lib/config';
import { useUser } from '@/stores/user';
import { Avatar } from '@/components/ui/Avatar';

interface NavItem { href: string; label: string; icon: IconName; match: (path: string) => boolean; }

const NAV: NavItem[] = [
  { href: '/', label: 'Home', icon: 'home', match: (path) => path === '/' },
  { href: '/search', label: 'Search', icon: 'search', match: (path) => path.startsWith('/search') },
  { href: '/explore', label: 'Explore', icon: 'compass', match: (path) => path.startsWith('/explore') },
  { href: '/library', label: 'Your Library', icon: 'library', match: (path) => path.startsWith('/library') },
];

const COLLECTIONS: NavItem[] = [
  { href: '/liked', label: 'Liked Songs', icon: 'heart', match: (path) => path.startsWith('/liked') },
  { href: '/recent', label: 'Recently Played', icon: 'clock', match: (path) => path.startsWith('/recent') },
  { href: '/charts', label: 'Charts', icon: 'chart', match: (path) => path.startsWith('/charts') },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-subtle bg-surface/70 p-4 lg:flex">
      <Link href="/" className="mb-7 flex items-center gap-2.5 px-2" aria-label={`${SITE.name} home`}>
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-white text-black"><Icon name="play" size={16} /></span>
        <span className="text-lg font-extrabold tracking-tight">{SITE.name}</span>
      </Link>
      <nav aria-label="Primary" className="flex flex-col gap-1">
        {NAV.map((item) => <NavLink key={item.href} item={item} active={item.match(pathname)} />)}
      </nav>
      <p className="mb-2 mt-8 px-3 text-[11px] font-bold uppercase tracking-[0.14em] text-text-muted">Your collection</p>
      <nav aria-label="Collection" className="flex flex-col gap-1">
        {COLLECTIONS.map((item) => <NavLink key={item.href} item={item} active={item.match(pathname)} />)}
      </nav>
      <ProfileFooter />
    </aside>
  );
}

function ProfileFooter() {
  const profile = useUser((state) => state.profile);
  const name = profile?.name || 'Listener';
  return (
    <Link href="/settings" className="mt-auto flex items-center gap-3 rounded-card border border-subtle bg-white/[0.03] p-2.5 transition-colors hover:bg-white/[0.07]">
      <Avatar name={name} avatarId={profile?.avatar ?? AVATARS[0].id} size={32} />
      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{name}</span><span className="block text-xs text-text-secondary">Your profile</span></span>
      <Icon name="gear" size={16} className="text-text-secondary" />
    </Link>
  );
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link href={item.href} aria-current={active ? 'page' : undefined} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${active ? 'bg-white text-black' : 'text-text-secondary hover:bg-white/5 hover:text-white'}`}>
      <Icon name={item.icon} size={19} />{item.label}
    </Link>
  );
}
