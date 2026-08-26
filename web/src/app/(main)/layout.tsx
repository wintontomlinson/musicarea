import { Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';
import { MobileNav } from '@/components/layout/MobileNav';
import { AudioEngine } from '@/components/player/AudioEngine';
import { MiniPlayer } from '@/components/player/MiniPlayer';
import { FullPlayer } from '@/components/player/FullPlayer';
import { QueuePanel } from '@/components/player/QueuePanel';
import { KeyboardShortcuts } from '@/components/player/KeyboardShortcuts';
import { MediaSession } from '@/components/player/MediaSession';
import { PlaybackAlert } from '@/components/player/PlaybackAlert';
import { AutoplayRadio } from '@/components/player/AutoplayRadio';
import { OnboardingGate } from '@/components/onboarding/OnboardingGate';

/**
 * Shared chrome for the primary app views, arranged the way Apple Music does:
 * a grouped sidebar on desktop, a toolbar that also carries playback on
 * desktop, and a tab bar with a floating mini player on mobile. The audio
 * engine and player surfaces are mounted here so playback persists across route
 * changes.
 *
 * Bottom padding only needs to clear the mobile mini player and tab bar; on
 * desktop the player sits in the toolbar, so the page just gets normal spacing.
 */
export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <OnboardingGate>
      <div className="flex min-h-screen bg-bg">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          <main className="flex-1 pb-40 lg:pb-10">{children}</main>
        </div>
        <MobileNav />

        {/* Player: engine + surfaces, always mounted. */}
        <AudioEngine />
        <MiniPlayer />
        <FullPlayer />
        <QueuePanel />
        <PlaybackAlert />
        <AutoplayRadio />
        <KeyboardShortcuts />
        <MediaSession />
      </div>
    </OnboardingGate>
  );
}
