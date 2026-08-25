'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { useUser } from '@/stores/user';
import { Avatar } from '@/components/ui/Avatar';

export function Topbar() {
  const router = useRouter();
  const [query, setQuery] = useState('');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (q) router.push(`/search?q=${encodeURIComponent(q)}`);
  }

  return (
    <header className="sticky top-0 z-30 border-b border-subtle bg-bg/95 px-4 py-3 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-[1440px] items-center gap-3">
        <div className="hidden items-center gap-1 sm:flex">
          <IconButton label="Go back" onClick={() => router.back()} icon="chevronLeft" />
          <IconButton label="Go forward" onClick={() => router.forward()} icon="chevronRight" />
        </div>

        <form role="search" onSubmit={submit} className="relative flex-1 max-w-lg">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary">
            <Icon name="search" size={18} />
          </span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search music"
            aria-label="Search"
            className="w-full rounded-full border border-subtle bg-surface py-2.5 pl-10 pr-4 text-sm text-white outline-none transition-colors placeholder:text-text-muted focus:border-white/25"
          />
        </form>

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
      <Avatar name={name} avatarId={profile?.avatar ?? 'coral'} size={34} />
    </Link>
  );
}

function IconButton({
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
      className="grid h-9 w-9 place-items-center rounded-full text-text-secondary transition-colors hover:bg-white/5 hover:text-white"
    >
      <Icon name={icon} size={18} />
    </button>
  );
}
