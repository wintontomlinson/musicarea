'use client';

import { useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon, type IconName } from '@/components/ui/Icon';
import { AVATARS, SITE } from '@/lib/config';
import { useUser } from '@/stores/user';
import { useLibrary } from '@/stores/library';
import { usePlayer } from '@/stores/player';
import { Avatar } from '@/components/ui/Avatar';
import { SidebarNowPlaying } from '@/components/layout/SidebarNowPlaying';
import { artistLine, entityHref, pickImage } from '@/lib/utils';

interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  match: (path: string) => boolean;
}

const DISCOVER: NavItem[] = [
  { href: '/', label: 'Home', icon: 'home', match: (path) => path === '/' },
  { href: '/search', label: 'Search', icon: 'search', match: (path) => path.startsWith('/search') },
  { href: '/explore', label: 'Explore', icon: 'compass', match: (path) => path.startsWith('/explore') },
  { href: '/charts', label: 'Charts', icon: 'chart', match: (path) => path.startsWith('/charts') },
];

const LIBRARY: NavItem[] = [
  { href: '/library', label: 'Your library', icon: 'library', match: (path) => path.startsWith('/library') },
  { href: '/liked', label: 'Liked songs', icon: 'heart', match: (path) => path.startsWith('/liked') },
  { href: '/recent', label: 'Recently played', icon: 'clock', match: (path) => path.startsWith('/recent') },
];

/**
 * Desktop navigation rail.
 *
 * Structured the way Spotify's sidebar is: fixed navigation at the top, the
 * listener's own collection below it, then the artwork of what is playing pinned to
 * the bottom. The reason that arrangement works is that the top section never
 * changes height, so the items in it stay in the same place all session and become
 * muscle memory, while the variable-length collection list absorbs the scrolling.
 *
 * The three regions are laid out as a column with only the middle one scrolling.
 * Making the whole rail scroll would push the now-playing card and the profile
 * footer off-screen, which are exactly the two things that should always be
 * reachable.
 */
export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="chrome-panel sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-white/10 lg:flex">
      <div className="shrink-0 px-3 pb-2 pt-4">
        <Link href="/" className="mb-6 flex items-center gap-2.5 px-2" aria-label={`${SITE.name} home`}>
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand text-on-accent shadow-glow">
            <Icon name="disc" size={20} />
          </span>
          <span className="text-[19px] font-extrabold tracking-[-0.05em]">{SITE.name}</span>
        </Link>

        <nav aria-label="Discover" className="flex flex-col gap-0.5">
          {DISCOVER.map((item) => (
            <NavLink key={item.href} item={item} active={item.match(pathname)} />
          ))}
        </nav>
      </div>

      {/* The scrolling middle. `min-h-0` is required: a flex child defaults to
          `min-height: auto`, which lets its content set the height and would push
          the footer below the viewport instead of scrolling here. */}
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-2">
        <nav aria-label="Your library" className="flex flex-col gap-0.5 border-t border-subtle pt-3">
          <NavGroupLabel label="Your library" />
          {LIBRARY.map((item) => (
            <NavLink key={item.href} item={item} active={item.match(pathname)} />
          ))}
        </nav>
        <JumpBackIn />
      </div>

      <div className="shrink-0 border-t border-subtle px-3 pb-3">
        <SidebarNowPlaying />
        <ProfileFooter />
      </div>
    </aside>
  );
}

function NavGroupLabel({ label }: { label: string }) {
  return (
    <p className="mb-1 px-3 text-[10px] font-bold uppercase tracking-[0.15em] text-text-muted">
      {label}
    </p>
  );
}

/**
 * Recently played tracks, as a compact list.
 *
 * This is the sidebar's stand-in for Spotify's playlist list. The app has no
 * user-created playlists yet, and listing the same three static library links twice
 * would be filler, so the slot shows real history instead: the fastest way back to
 * something you were listening to five minutes ago.
 */
function JumpBackIn() {
  const hydrate = useLibrary((state) => state.hydrate);
  const hydrated = useLibrary((state) => state.hydrated);
  const recent = useLibrary((state) => state.recent);
  const playQueue = usePlayer((state) => state.playQueue);
  const currentId = usePlayer((state) => state.currentTrack()?.id);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // Nothing is rendered before hydration on purpose. The server has no access to
  // localStorage, so rendering a list here would guarantee a hydration mismatch.
  if (!hydrated || recent.length === 0) return null;

  const items = recent.slice(0, 5);

  return (
    <div className="mt-5 border-t border-subtle pt-3">
      <div className="mb-1 flex items-center justify-between px-3">
        <NavGroupLabel label="Jump back in" />
        <Link href="/recent" className="mb-1 text-[10px] font-bold text-accent-soft hover:text-white">
          All
        </Link>
      </div>
      <ul className="flex flex-col">
        {items.map((song) => {
          const active = song.id === currentId;
          return (
            <li key={song.id} className="group relative">
              {/* The row is a link to the song page, with playback on a nested
                  button. Making the whole row play instead would remove the only
                  way to reach the song's own page from here, and a link is what
                  supports opening it in a new tab. */}
              <Link
                href={entityHref('song', song.name, song.id)}
                className={`flex items-center gap-2.5 rounded-lg py-1.5 pl-2 pr-9 transition ${
                  active ? 'bg-accent/[0.12]' : 'hover:bg-white/[0.06]'
                }`}
              >
                <Image
                  src={pickImage(song.image, '150x150')}
                  alt=""
                  width={34}
                  height={34}
                  className="shrink-0 rounded-[7px] object-cover"
                />
                <span className="min-w-0 flex-1">
                  <span
                    className={`block truncate text-[12.5px] font-semibold ${active ? 'text-accent-soft' : ''}`}
                  >
                    {song.name}
                  </span>
                  <span className="block truncate text-[10.5px] text-text-muted">
                    {artistLine(song)}
                  </span>
                </span>
              </Link>
              <button
                type="button"
                aria-label={`Play ${song.name}`}
                onClick={() => playQueue(items, items.indexOf(song))}
                className="absolute right-1.5 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full bg-accent text-on-accent opacity-0 shadow-glow transition group-hover:opacity-100 focus-visible:opacity-100"
              >
                <Icon name="play" size={13} />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ProfileFooter() {
  const profile = useUser((state) => state.profile);
  const name = profile?.name || 'Listener';
  return (
    <div className="mt-2 flex items-center gap-1">
      <Link
        href="/profile"
        className="flex min-w-0 flex-1 items-center gap-2.5 rounded-card border border-transparent px-2 py-2 transition hover:border-white/10 hover:bg-white/[0.06]"
      >
        <Avatar name={name} avatarId={profile?.avatar ?? AVATARS[0].id} size={29} className="shadow-glow" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-bold">{name}</span>
          <span className="block truncate text-[10.5px] text-text-muted">View your listening</span>
        </span>
      </Link>
      {/* Settings is a separate target rather than living inside the profile link.
          It is a different destination, and nesting it would have made the whole
          row ambiguous about where a click lands. */}
      <Link
        href="/settings"
        aria-label="Settings"
        className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-text-secondary transition hover:bg-white/10 hover:text-white"
      >
        <Icon name="gear" size={17} />
      </Link>
    </div>
  );
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-semibold transition ${
        active
          ? 'bg-brand text-on-accent shadow-glow'
          : 'text-text-secondary hover:bg-white/[0.07] hover:text-white'
      }`}
    >
      <Icon name={item.icon} size={18} className="shrink-0" />
      {item.label}
    </Link>
  );
}
