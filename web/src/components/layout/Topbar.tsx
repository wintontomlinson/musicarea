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
    <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0b0717]/65 px-4 py-3 backdrop-blur-xl sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-[1680px] items-center gap-3">
        <div className="hidden items-center gap-1 sm:flex">
          <NavButton label="Go back" icon="chevronLeft" onClick={() => router.back()} />
          <NavButton label="Go forward" icon="chevronRight" onClick={() => router.forward()} />
        </div>

        {/* Transport from `lg`, which is where the mobile mini player stops.
            Both used to appear only at `xl`, leaving everything from 1024px to
            1279px with a now-playing plate and a seek bar but no way to pause:
            the mini player was already hidden and the toolbar controls had not
            arrived yet. Volume stays at `xl`, since it is the one control here
            that has a hardware equivalent and the narrower toolbar needs room. */}
        <div className="hidden shrink-0 items-center gap-2 lg:flex">
          <TransportControls size="mini" />
          <span className="hidden xl:flex">
            <VolumeControl />
          </span>
        </div>

        <NowPlayingBar />

        <button type="button" aria-label="Queue" aria-pressed={queueOpen} onClick={() => setQueueOpen(!queueOpen)} className={`hidden h-9 w-9 shrink-0 place-items-center rounded-full transition lg:grid ${queueOpen ? 'bg-accent text-white shadow-glow' : 'bg-white/[0.07] text-text-secondary hover:bg-white/[0.12] hover:text-white'}`}>
          <Icon name="queue" size={18} />
        </button>

        <form role="search" onSubmit={submit} className="relative min-w-0 flex-1 lg:max-w-[250px] lg:flex-none">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary"><Icon name="search" size={16} /></span>
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search music" aria-label="Search" className="w-full rounded-full border border-white/10 bg-white/[0.07] py-2 pl-9 pr-3 text-[13px] text-white outline-none transition placeholder:text-text-muted focus:border-fuchsia-300/60 focus:bg-white/[0.12]" />
        </form>

        <Link href="/settings" aria-label="Open profile" className="shrink-0 rounded-full"><AvatarButton /></Link>
      </div>
    </header>
  );
}

function AvatarButton() {
  const profile = useUser((state) => state.profile);
  return <Avatar name={profile?.name || 'Listener'} avatarId={profile?.avatar ?? AVATARS[0].id} size={31} className="ring-2 ring-fuchsia-300/40 shadow-glow" />;
}

function NavButton({ label, icon, onClick }: { label: string; icon: 'chevronLeft' | 'chevronRight'; onClick: () => void }) {
  return <button type="button" aria-label={label} onClick={onClick} className="grid h-8 w-8 place-items-center rounded-full text-text-secondary transition hover:bg-white/10 hover:text-white"><Icon name={icon} size={17} /></button>;
}
