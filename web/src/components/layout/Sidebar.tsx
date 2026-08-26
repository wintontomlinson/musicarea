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
  exact?: boolean;
}

const PRIMARY: NavItem[] = [
  { href: '/', label: 'Home', icon: 'home', exact: true },
  { href: '/search', label: 'Search', icon: 'search' },
  { href: '/library', label: 'Library', icon: 'library' },
];

const BROWSE: NavItem[] = [
  { href: '/explore', label: 'Explore', icon: 'compass' },
  { href: '/charts', label: 'Charts', icon: 'chart' },
  { href: '/genres', label: 'Genres', icon: 'grid' },
];

const COLLECTION: NavItem[] = [
  { href: '/liked', label: 'Liked Songs', icon: 'heart' },
  { href: '/history', label: 'Recently Played', icon: 'clock' },
  { href: '/playlists', label: 'Playlists', icon: 'playlist' },
  { href: '/albums', label: 'Albums', icon: 'disc' },
  { href: '/artists', label: 'Artists', icon: 'user' },
];

/**
 * Desktop navigation rail. Fixed width, three labelled groups, and a profile
 * row pinned to the bottom. The active row is marked with an accent glyph, an
 * accent left edge and a faint wash rather than a filled pill, so a long list
 * of destinations stays quiet.
 */
export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-screen w-sidebar shrink-0 flex-col border-r border-subtle bg-bg-alt lg:flex">
      <Link
        href="/"
        aria-label={`${SITE.name} home`}
        className="flex items-center gap-2.5 px-5 pb-6 pt-5"
      >
        <span className="grid h-8 w-8 place-items-center rounded-sm bg-accent text-white">
          <Icon name="disc" size={19} />
        </span>
        <span className="text-[17px] font-bold tracking-[-0.03em]">{SITE.name}</span>
      </Link>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto pb-2">
        <nav aria-label="Main" className="px-2">
          {PRIMARY.map((item) => (
            <NavRow key={item.href} item={item} active={isActive(pathname, item)} />
          ))}
        </nav>

        <NavGroup label="Browse">
          {BROWSE.map((item) => (
            <NavRow key={item.href} item={item} active={isActive(pathname, item)} />
          ))}
        </NavGroup>

        <NavGroup label="Your collection">
          {COLLECTION.map((item) => (
            <NavRow key={item.href} item={item} active={isActive(pathname, item)} />
          ))}
        </NavGroup>
      </div>

      <div className="border-t border-subtle p-2">
        <NavRow
          item={{ href: '/settings', label: 'Settings', icon: 'gear' }}
          active={pathname.startsWith('/settings')}
        />
        <ProfileRow />
      </div>
    </aside>
  );
}

function isActive(pathname: string, item: NavItem): boolean {
  return item.exact ? pathname === item.href : pathname.startsWith(item.href);
}

function NavGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <nav aria-label={label} className="mt-7 px-2">
      <p className="t-micro px-3 pb-1.5">{label}</p>
      {children}
    </nav>
  );
}

function NavRow({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={`relative flex items-center gap-3 rounded-sm px-3 py-2 text-body font-medium transition-colors duration-fast ${
        active ? 'bg-white/[0.07] text-text' : 'text-text-secondary hover:bg-white/5 hover:text-text'
      }`}
    >
      {active && (
        <span
          aria-hidden="true"
          className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r-full bg-accent"
        />
      )}
      <Icon
        name={item.icon}
        size={18}
        className={active ? 'shrink-0 text-accent' : 'shrink-0'}
      />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

function ProfileRow() {
  const profile = useUser((state) => state.profile);
  const name = profile?.name || 'Listener';
  return (
    <Link
      href="/settings"
      className="mt-1 flex items-center gap-2.5 rounded-sm px-3 py-2 transition-colors duration-fast hover:bg-white/5"
    >
      <Avatar name={name} avatarId={profile?.avatar ?? AVATARS[0].id} size={26} />
      <span className="min-w-0 flex-1 truncate text-meta font-medium text-text">{name}</span>
    </Link>
  );
}
