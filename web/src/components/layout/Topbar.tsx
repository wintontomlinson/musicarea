'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { Avatar } from '@/components/ui/Avatar';
import { AVATARS, SITE } from '@/lib/config';
import { useUser } from '@/stores/user';
import { Menu } from '@/components/ui/Menu';

/**
 * Application header. Deliberately thin: history navigation, a compact search
 * entry and the profile menu. Playback is not here, it lives in the persistent
 * player at the bottom of the window.
 *
 * The header is transparent over the top of a page and gains a background once
 * the content scrolls beneath it, so editorial artwork can run to the top edge.
 */
export function Topbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState('');
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // The search page owns its own field, so the header does not duplicate it.
  const onSearchPage = pathname.startsWith('/search');

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const value = query.trim();
    if (value) router.push(`/search?q=${encodeURIComponent(value)}`);
  }

  return (
    <header
      className={`sticky top-0 z-30 transition-colors duration-base ${
        scrolled ? 'border-b border-subtle bg-bg/95 backdrop-blur-sm' : 'bg-transparent'
      }`}
    >
      <div className="flex h-14 items-center gap-2 px-4 sm:px-7 lg:px-10">
        <Link href="/" className="flex items-center gap-2 lg:hidden" aria-label={`${SITE.name} home`}>
          <span className="grid h-7 w-7 place-items-center rounded-xs bg-accent text-white">
            <Icon name="disc" size={16} />
          </span>
          <span className="text-[15px] font-bold tracking-[-0.03em]">{SITE.name}</span>
        </Link>

        <div className="hidden items-center gap-1 lg:flex">
          <button
            type="button"
            aria-label="Go back"
            onClick={() => router.back()}
            className="btn-icon"
          >
            <Icon name="chevronLeft" size={18} />
          </button>
          <button
            type="button"
            aria-label="Go forward"
            onClick={() => router.forward()}
            className="btn-icon"
          >
            <Icon name="chevronRight" size={18} />
          </button>
        </div>

        {!onSearchPage && (
          <form role="search" onSubmit={submit} className="relative ml-auto hidden w-56 lg:block">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">
              <Icon name="search" size={16} />
            </span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search"
              aria-label="Search music"
              className="field py-2 pl-9 pr-3 text-meta"
            />
          </form>
        )}

        <div className={onSearchPage ? 'ml-auto' : 'ml-auto lg:ml-0'}>
          <ProfileMenu />
        </div>
      </div>
    </header>
  );
}

function ProfileMenu() {
  const profile = useUser((state) => state.profile);
  const name = profile?.name || 'Listener';

  return (
    <Menu
      label="Account"
      items={[
        { label: 'Your library', icon: 'library', href: '/library' },
        { label: 'Liked songs', icon: 'heart', href: '/liked' },
        { label: 'Recently played', icon: 'clock', href: '/history' },
        { label: 'Settings', icon: 'gear', href: '/settings', separated: true },
      ]}
    >
      <Avatar name={name} avatarId={profile?.avatar ?? AVATARS[0].id} size={28} />
    </Menu>
  );
}
