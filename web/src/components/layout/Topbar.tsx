'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { useUser } from '@/stores/user';
import { Avatar } from '@/components/ui/Avatar';

/**
 * Top bar for the main content area: history navigation, a search field that
 * routes to /search, and account actions. History buttons use the router since
 * this is a client component.
 */
export function Topbar() {
  const router = useRouter();
  const [query, setQuery] = useState('');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (q) router.push(`/search?q=${encodeURIComponent(q)}`);
  }

  return (
    <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-subtle bg-bg/70 px-4 py-3 backdrop-blur-glass sm:px-6">
      <div className="hidden items-center gap-2 sm:flex">
        <IconButton label="Go back" onClick={() => router.back()} icon="chevronLeft" />
        <IconButton label="Go forward" onClick={() => router.forward()} icon="chevronRight" />
      </div>

      <form role="search" onSubmit={submit} className="relative flex-1 max-w-xl">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary">
          <Icon name="search" size={18} />
        </span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Songs, artists, albums, playlists"
          aria-label="Search"
          className="w-full rounded-full border border-subtle bg-surface-raised/70 py-2.5 pl-10 pr-4 text-sm text-white outline-none transition-colors duration-150 placeholder:text-text-muted focus:border-accent/60"
        />
      </form>

      <div className="ml-auto flex items-center gap-2">
        <IconButton label="Notifications" icon="bell" />
        <AccountButton />
      </div>
    </header>
  );
}

function AccountButton() {
  const profile = useUser((s) => s.profile);
  const name = profile?.name || 'Listener';
  return (
    <Link href="/settings" aria-label={`Account: ${name}`} className="rounded-full">
      <Avatar name={name} avatarId={profile?.avatar ?? 'coral'} size={36} />
    </Link>
  );
}

function IconButton({
  label,
  icon,
  onClick,
}: {
  label: string;
  icon: 'chevronLeft' | 'chevronRight' | 'bell';
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="grid h-9 w-9 place-items-center rounded-full border border-subtle text-text-secondary transition-colors duration-150 hover:bg-white/5 hover:text-white"
    >
      <Icon name={icon} size={18} />
    </button>
  );
}
