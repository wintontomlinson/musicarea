import { Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';
import { MobileNav } from '@/components/layout/MobileNav';
import { AudioEngine } from '@/components/player/AudioEngine';
import { MiniPlayer } from '@/components/player/MiniPlayer';
import { FullPlayer } from '@/components/player/FullPlayer';
import { QueuePanel } from '@/components/player/QueuePanel';
import { KeyboardShortcuts } from '@/components/player/KeyboardShortcuts';
import { MediaSession } from '@/components/player/MediaSession';

/**
 * Shared chrome for the primary app views: a fixed sidebar on desktop, a top
 * bar with search, and a bottom tab bar on mobile. The audio engine and player
 * surfaces are mounted here so playback persists across route changes.
 *
 * Bottom padding clears the mini player (and, on mobile, the tab bar beneath
 * it), so the last row of content is never hidden.
 */
export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="flex-1 pb-40 lg:pb-28">{children}</main>
      </div>
      <MobileNav />

      {/* Player: engine + surfaces, always mounted. */}
      <AudioEngine />
      <MiniPlayer />
      <FullPlayer />
      <QueuePanel />
      <KeyboardShortcuts />
      <MediaSession />
    </div>
  );
}
