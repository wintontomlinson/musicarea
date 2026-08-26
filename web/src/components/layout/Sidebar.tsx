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
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-white/10 bg-[#0b0717]/80 px-3 py-4 backdrop-blur-xl lg:flex">
      <Link href="/" className="mb-8 flex items-center gap-3 px-2" aria-label={`${SITE.name} home`}>
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand text-white shadow-glow">
          <Icon name="disc" size={20} />
        </span>
        <span className="text-[20px] font-extrabold tracking-[-0.05em]">{SITE.name}</span>
      </Link>

      <nav aria-label="Discover" className="flex flex-col gap-1">
        <NavGroupLabel label="Discover" />
        {DISCOVER.map((item) => <NavLink key={item.href} item={item} active={item.match(pathname)} />)}
      </nav>

      <nav aria-label="Library" className="mt-7 flex flex-col gap-1">
        <NavGroupLabel label="Your collection" />
        {LIBRARY.map((item) => <NavLink key={item.href} item={item} active={item.match(pathname)} />)}
      </nav>

      <div className="mt-7 rounded-card border border-fuchsia-300/15 bg-gradient-to-br from-fuchsia-500/15 via-violet-500/10 to-cyan-400/10 p-3">
        <span className="section-kicker">Tonight&apos;s vibe</span>
        <p className="mt-1 text-[13px] font-semibold leading-snug text-white">Discover a new sound, then let the queue take over.</p>
        <Link href="/explore" className="mt-3 inline-flex items-center gap-1 text-[12px] font-bold text-accent-soft hover:text-white">
          Explore music <Icon name="chevronRight" size={13} />
        </Link>
      </div>

      <ProfileFooter />
    </aside>
  );
}

function NavGroupLabel({ label }: { label: string }) {
  return <p className="mb-1 px-3 text-[10px] font-bold uppercase tracking-[0.15em] text-text-muted">{label}</p>;
}

function ProfileFooter() {
  const profile = useUser((state) => state.profile);
  const name = profile?.name || 'Listener';
  return (
    <Link href="/settings" className="mt-auto flex items-center gap-2.5 rounded-card border border-transparent px-2 py-2.5 transition hover:border-white/10 hover:bg-white/[0.06]">
      <Avatar name={name} avatarId={profile?.avatar ?? AVATARS[0].id} size={30} className="shadow-glow" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-bold">{name}</span>
        <span className="block truncate text-[11px] text-text-muted">Local profile</span>
      </span>
      <Icon name="gear" size={16} className="text-text-secondary" />
    </Link>
  );
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-semibold transition ${
        active ? 'bg-brand text-white shadow-glow' : 'text-text-secondary hover:bg-white/[0.07] hover:text-white'
      }`}
    >
      <Icon name={item.icon} size={18} className="shrink-0" />
      {item.label}
    </Link>
  );
}
