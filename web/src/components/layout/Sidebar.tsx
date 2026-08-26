'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon, type IconName } from '@/components/ui/Icon';
import { AVATARS, SITE } from '@/lib/config';
import { useUser } from '@/stores/user';
import { Avatar } from '@/components/ui/Avatar';

interface NavItem { href: string; label: string; icon: IconName; match: (path: string) => boolean; }

const DISCOVER: NavItem[] = [
  { href: '/', label: 'Home', icon: 'home', match: (path) => path === '/' },
  { href: '/explore', label: 'Explore', icon: 'compass', match: (path) => path.startsWith('/explore') },
  { href: '/charts', label: 'Charts', icon: 'chart', match: (path) => path.startsWith('/charts') },
  { href: '/search', label: 'Search', icon: 'search', match: (path) => path.startsWith('/search') },
];

const LIBRARY: NavItem[] = [
  { href: '/library', label: 'Your space', icon: 'library', match: (path) => path.startsWith('/library') },
  { href: '/recent', label: 'Recent', icon: 'clock', match: (path) => path.startsWith('/recent') },
  { href: '/liked', label: 'Favourites', icon: 'heart', match: (path) => path.startsWith('/liked') },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-white/10 bg-[#111017] px-3 py-5 lg:flex">
      <Link href="/" className="mb-8 flex items-center gap-2.5 px-2" aria-label={`${SITE.name} home`}>
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent text-white"><Icon name="disc" size={18} /></span>
        <span className="text-[19px] font-extrabold tracking-[-0.045em]">{SITE.name}</span>
      </Link>

      <nav aria-label="Discover" className="flex flex-col gap-1">
        <NavGroupLabel label="Discover" />
        {DISCOVER.map((item) => <NavLink key={item.href} item={item} active={item.match(pathname)} />)}
      </nav>

      <nav aria-label="Library" className="mt-7 flex flex-col gap-1">
        <NavGroupLabel label="Library" />
        {LIBRARY.map((item) => <NavLink key={item.href} item={item} active={item.match(pathname)} />)}
      </nav>

      <ProfileFooter />
    </aside>
  );
}

function NavGroupLabel({ label }: { label: string }) {
  return <p className="mb-1 px-3 text-[11px] font-medium text-text-muted">{label}</p>;
}

function ProfileFooter() {
  const profile = useUser((state) => state.profile);
  const name = profile?.name || 'Listener';
  return (
    <Link href="/settings" className="mt-auto flex items-center gap-2.5 rounded-lg px-2 py-2.5 transition-colors hover:bg-white/[0.06]">
      <Avatar name={name} avatarId={profile?.avatar ?? AVATARS[0].id} size={29} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-semibold">{name}</span>
        <span className="block truncate text-[11px] text-text-muted">Local profile</span>
      </span>
      <Icon name="gear" size={16} className="text-text-secondary" />
    </Link>
  );
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link href={item.href} aria-current={active ? 'page' : undefined} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-[14px] font-semibold transition-colors ${active ? 'bg-white/[0.12] text-white' : 'text-text-secondary hover:bg-white/[0.06] hover:text-white'}`}>
      <Icon name={item.icon} size={18} className={active ? 'text-accent-soft' : 'shrink-0'} />
      {item.label}
    </Link>
  );
}
