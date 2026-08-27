import { Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';
import { MobileNav } from '@/components/layout/MobileNav';
import { AudioEngine } from '@/components/player/AudioEngine';
import { PlayerBar } from '@/components/player/PlayerBar';
import { FullPlayer } from '@/components/player/FullPlayer';
import { QueuePanel } from '@/components/player/QueuePanel';
import { KeyboardShortcuts } from '@/components/player/KeyboardShortcuts';
import { MediaSession } from '@/components/player/MediaSession';
import { PlaybackAlert } from '@/components/player/PlaybackAlert';
import { OnboardingGate } from '@/components/onboarding/OnboardingGate';
import { DynamicTheme } from '@/components/theme/DynamicTheme';
import { PageTransition } from '@/components/motion/PageTransition';

/**
 * Shared chrome for the primary app views: a grouped sidebar on desktop, a tab bar
 * on mobile, a navigational toolbar on top, and one persistent player bar along the
 * bottom on both. The audio engine and player surfaces are mounted here so playback
 * survives route changes.
 */
export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <OnboardingGate>
      <div className="flex min-h-screen bg-bg">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          {/*
            Bottom padding clears the fixed chrome, and now has to do so on both
            breakpoints. It used to be `lg:pb-10`, because desktop carried the player
            in the toolbar and had nothing fixed along the bottom; with the player bar
            there, that would let the last row of content sit underneath it.

            The values are generous rather than exact (the bar is 72px, the mobile
            card plus tab bar around 130px) so a focus ring or a hover lift on the
            final row is not clipped by the bar's edge.
          */}
          <main className="flex-1 pb-40 lg:pb-28">
            <PageTransition>{children}</PageTransition>
          </main>
        </div>
        <MobileNav />

        {/* Colours the design tokens from the artwork on screen. Renders nothing, and
            sits with the engine because it is a subscriber to the player in exactly
            the same way. */}
        <DynamicTheme />

        {/* Player: engine + surfaces, always mounted. */}
        <AudioEngine />
        <PlayerBar />
        <FullPlayer />
        <QueuePanel />
        <PlaybackAlert />
        <KeyboardShortcuts />
        <MediaSession />
      </div>
    </OnboardingGate>
  );
}
