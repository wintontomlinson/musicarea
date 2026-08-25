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

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const value = query.trim();
    if (value) router.push(`/search?q=${encodeURIComponent(value)}`);
  }

  return (
    <header className="sticky top-0 z-30 bg-bg px-4 py-4 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-[1200px] items-center gap-3">
        <form role="search" onSubmit={submit} className="relative max-w-lg flex-1">
          <span className="pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 text-text-secondary">
            <Icon name="search" size={18} />
          </span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search music"
            aria-label="Search"
            className="w-full border-b border-subtle bg-transparent py-2 pl-7 pr-2 text-sm text-white outline-none placeholder:text-text-muted focus:border-white"
          />
        </form>
        <AccountButton />
      </div>
    </header>
  );
}

function AccountButton() {
  const profile = useUser((state) => state.profile);
  const name = profile?.name || 'Listener';
  return (
    <Link href="/settings" aria-label={`Account: ${name}`}>
      <Avatar name={name} avatarId={profile?.avatar ?? 'coral'} size={30} />
    </Link>
  );
}
