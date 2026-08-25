import { Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';
import { MobileNav } from '@/components/layout/MobileNav';

/**
 * Shared chrome for the primary app views: a fixed sidebar on desktop, a top
 * bar with search, and a bottom tab bar on mobile. The scrollable content area
 * carries bottom padding so the mobile nav never covers the last row.
 */
export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="flex-1 pb-24 lg:pb-10">{children}</main>
      </div>
      <MobileNav />
    </div>
  );
}
