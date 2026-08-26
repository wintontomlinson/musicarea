import { Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';
import { MobileNav } from '@/components/layout/MobileNav';
import { AudioEngine } from '@/components/player/AudioEngine';
import { AutoplayExtender } from '@/components/player/AutoplayExtender';
import { BottomPlayer } from '@/components/player/BottomPlayer';
import { MiniPlayer } from '@/components/player/MiniPlayer';
import { NowPlaying } from '@/components/player/NowPlaying';
import { QueuePanel } from '@/components/player/QueuePanel';
import { LyricsPanel } from '@/components/player/LyricsPanel';
import { KeyboardShortcuts } from '@/components/player/KeyboardShortcuts';
import { MediaSession } from '@/components/player/MediaSession';
import { PlaybackErrorWatcher } from '@/components/player/PlaybackErrorWatcher';
import { OnboardingGate } from '@/components/onboarding/OnboardingGate';
import { Toaster } from '@/components/ui/Toaster';
import { LibraryBridge } from '@/components/library/LibraryBridge';
import { AddToPlaylistDialog } from '@/components/playlists/AddToPlaylistDialog';

/**
 * Application shell.
 *
 * The navigation rail, header and player are mounted once here and persist
 * across route changes, which is what keeps audio playing during navigation.
 * Page content is the only thing that swaps.
 *
 * Bottom padding clears whichever player is visible at the current breakpoint:
 * the mini player above the tab bar on mobile, the player bar on desktop.
 */
export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <OnboardingGate>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[80] focus:rounded-sm focus:bg-accent focus:px-4 focus:py-2 focus:text-body focus:font-semibold focus:text-white"
      >
        Skip to content
      </a>

      <div className="min-h-screen bg-bg">
        <div className="flex">
          <Sidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <Topbar />
            <main
              id="main"
              className="flex-1 pb-[calc(var(--tabbar-h)+76px+env(safe-area-inset-bottom))] lg:pb-[calc(var(--player-h)+28px)]"
            >
              {children}
            </main>
          </div>
        </div>

        <MobileNav />

        {/* Player surfaces. Always mounted so playback survives navigation. */}
        <BottomPlayer />
        <MiniPlayer />
        <NowPlaying />
        <QueuePanel />
        <LyricsPanel />
        <AddToPlaylistDialog />

        {/* Headless: audio engine, OS integration, shortcuts, notifications. */}
        <AudioEngine />
        <AutoplayExtender />
        <MediaSession />
        <KeyboardShortcuts />
        <PlaybackErrorWatcher />
        <LibraryBridge />
        <Toaster />
      </div>
    </OnboardingGate>
  );
}
