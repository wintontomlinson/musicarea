'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { useUser } from '@/stores/user';
import { Avatar } from '@/components/ui/Avatar';
import { AVATARS } from '@/lib/config';
import { TransportControls } from '@/components/player/PlayerControls';
import { VolumeControl } from '@/components/player/VolumeControl';
import { NowPlayingBar } from '@/components/player/NowPlayingBar';
import { usePlayer } from '@/stores/player';

/**
 * Apple Music's toolbar. On desktop it carries history navigation, the
 * transport controls, volume, the centred now-playing LCD, the queue toggle and
 * search, exactly as the Mac app puts playback in the window chrome. On mobile
 * it reduces to search and the profile, because playback lives in the bottom
 * mini player there.
 */
export function Topbar() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const setQueueOpen = usePlayer((state) => state.setQueueOpen);
  const queueOpen = usePlayer((state) => state.queueOpen);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const value = query.trim();
    if (value) router.push(`/search?q=${encodeURIComponent(value)}`);
  }

  return (
    <header className="glass-panel sticky top-0 z-30 border-x-0 border-t-0 px-4 py-2.5 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-[1600px] items-center gap-3">
        <div className="hidden items-center gap-0.5 sm:flex">
          <NavButton label="Go back" icon="chevronLeft" onClick={() => router.back()} />
          <NavButton label="Go forward" icon="chevronRight" onClick={() => router.forward()} />
        </div>

        {/* Playback lives in the toolbar on desktop, Apple Music style. */}
        <div className="hidden lg:flex lg:items-center lg:gap-2">
          <TransportControls size="mini" />
          <VolumeControl />
        </div>

        <NowPlayingBar />

        <button
          type="button"
          aria-label="Queue"
          aria-pressed={queueOpen}
          onClick={() => setQueueOpen(!queueOpen)}
          className={`hidden shrink-0 transition-colors lg:block ${
            queueOpen ? 'text-accent' : 'text-text-secondary hover:text-white'
          }`}
        >
          <Icon name="queue" size={19} />
        </button>

        <form role="search" onSubmit={submit} className="relative min-w-0 flex-1 lg:max-w-[240px] lg:flex-none">
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-text-secondary">
            <Icon name="search" size={16} />
          </span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search"
            aria-label="Search"
            className="w-full rounded-lg bg-white/[0.09] py-1.5 pl-8 pr-3 text-[13px] text-white outline-none transition-colors placeholder:text-text-muted focus:bg-white/[0.14]"
          />
        </form>

        <Link href="/settings" aria-label="Open profile" className="shrink-0">
          <AvatarButton />
        </Link>
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
      size={28}
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
      className="grid h-8 w-8 place-items-center rounded-md text-text-secondary transition-colors hover:bg-white/10 hover:text-white"
    >
      <Icon name={icon} size={17} />
    </button>
  );
}
