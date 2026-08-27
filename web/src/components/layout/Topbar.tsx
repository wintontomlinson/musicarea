'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { useUser } from '@/stores/user';
import { Avatar } from '@/components/ui/Avatar';
import { AVATARS } from '@/lib/config';

/**
 * Top toolbar: navigation history, a search field, and the profile avatar.
 *
 * This used to host the desktop player as well (transport, volume, the now-playing
 * display and the queue toggle). All of that moved to `PlayerBar` at the bottom of
 * the viewport, which is where every desktop music app puts it and which frees the
 * toolbar to do one job. The toolbar is now purely navigational.
 */
export function Topbar() {
  const router = useRouter();
  const [query, setQuery] = useState('');

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const value = query.trim();
    if (value) router.push(`/search?q=${encodeURIComponent(value)}`);
  }

  return (
    // `--chrome-alpha` keeps the toolbar more transparent than the sidebar: it sits
    // directly over scrolling content, where the sidebar does not.
    <header className="chrome-panel sticky top-0 z-30 border-b border-white/10 px-4 py-2.5 [--chrome-alpha:0.65] sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-[1680px] items-center gap-3">
        <div className="hidden items-center gap-1 sm:flex">
          <NavButton label="Go back" icon="chevronLeft" onClick={() => router.back()} />
          <NavButton label="Go forward" icon="chevronRight" onClick={() => router.forward()} />
        </div>

        {/* Grows to fill on mobile, where it is the only search entry point, and is
            capped on desktop so it does not stretch across an empty toolbar. */}
        <form role="search" onSubmit={submit} className="relative min-w-0 flex-1 lg:max-w-[320px]">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary">
            <Icon name="search" size={16} />
          </span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Songs, artists, albums"
            aria-label="Search"
            className="w-full rounded-pill border border-white/10 bg-white/[0.07] py-2 pl-9 pr-3 text-[13px] text-white outline-none transition placeholder:text-text-muted focus:border-accent/60 focus:bg-white/[0.12]"
          />
        </form>

        <div className="ml-auto flex shrink-0 items-center gap-1">
          <Link
            href="/settings"
            aria-label="Settings"
            className="hidden h-9 w-9 place-items-center rounded-full text-text-secondary transition hover:bg-white/10 hover:text-white lg:grid"
          >
            <Icon name="gear" size={18} />
          </Link>
          <Link href="/profile" aria-label="Your listening" className="shrink-0 rounded-full">
            <AvatarButton />
          </Link>
        </div>
      </div>
    </header>
  );
}

function AvatarButton() {
  const profile = useUser((state) => state.profile);
  return (
    <Avatar
      name={profile?.name || 'Listener'}
      avatarId={profile?.avatar ?? AVATARS[0].id}
      size={31}
      className="shadow-glow ring-2 ring-accent/40"
    />
  );
}

function NavButton({
  label,
  icon,
  onClick,
}: {
  label: string;
  icon: 'chevronLeft' | 'chevronRight';
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="grid h-8 w-8 place-items-center rounded-full text-text-secondary transition hover:bg-white/10 hover:text-white"
    >
      <Icon name={icon} size={17} />
    </button>
  );
}
