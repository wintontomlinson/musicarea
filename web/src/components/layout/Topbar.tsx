'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { useUser } from '@/stores/user';
import { Avatar } from '@/components/ui/Avatar';
import { AVATARS } from '@/lib/config';

export function Topbar() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  function submit(event: React.FormEvent) {
    event.preventDefault();
    const value = query.trim();
    if (value) router.push(`/search?q=${encodeURIComponent(value)}`);
  }
  return (
    <header className="sticky top-0 z-30 bg-bg/80 px-4 py-3 backdrop-blur-xl sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-[1440px] items-center gap-3">
        <div className="hidden items-center gap-1 sm:flex">
          <NavButton label="Go back" icon="chevronLeft" onClick={() => router.back()} />
          <NavButton label="Go forward" icon="chevronRight" onClick={() => router.forward()} />
        </div>
        <form role="search" onSubmit={submit} className="relative max-w-xl flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary"><Icon name="search" size={18} /></span>
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search songs, artists, albums" aria-label="Search" className="w-full rounded-full border border-subtle bg-surface py-2.5 pl-10 pr-4 text-sm text-white outline-none transition-colors placeholder:text-text-muted focus:border-white/35" />
        </form>
        <Link href="/settings" aria-label="Open profile"><AvatarButton /></Link>
      </div>
    </header>
  );
}

function AvatarButton() {
  const profile = useUser((state) => state.profile);
  return <Avatar name={profile?.name || 'Listener'} avatarId={profile?.avatar ?? AVATARS[0].id} size={34} />;
}

function NavButton({ label, icon, onClick }: { label: string; icon: 'chevronLeft' | 'chevronRight'; onClick: () => void }) {
  return <button type="button" aria-label={label} onClick={onClick} className="grid h-9 w-9 place-items-center rounded-full text-text-secondary transition-colors hover:bg-white/10 hover:text-white"><Icon name={icon} size={18} /></button>;
}
