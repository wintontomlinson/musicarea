import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { SITE } from '@/lib/config';
import { JsonLd } from '@/components/seo/JsonLd';
import { MotionProvider } from '@/components/motion/MotionProvider';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: `${SITE.name} · ${SITE.tagline}`,
    template: `%s | ${SITE.name}`,
  },
  description: SITE.description,
  applicationName: SITE.name,
  keywords: ['music', 'streaming', 'songs', 'albums', 'artists', 'playlists', 'free music'],
  openGraph: {
    type: 'website',
    siteName: SITE.name,
    title: `${SITE.name} · ${SITE.tagline}`,
    description: SITE.description,
    url: SITE.url,
  },
  twitter: {
    card: 'summary_large_image',
    title: `${SITE.name} · ${SITE.tagline}`,
    description: SITE.description,
  },
  robots: { index: true, follow: true },
  alternates: { canonical: '/' },
};

export const viewport: Viewport = {
  // Matches the default --bg-rgb in globals.css. It was pure black, which left a
  // visible seam between the browser chrome and the page on mobile. This is only
  // the starting value: `applyPalette` in src/lib/color.ts rewrites this meta tag
  // whenever the artwork palette changes, so the chrome follows the album too.
  themeColor: '#090613',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-bg font-sans text-white antialiased">
        {/* WebSite structured data with a SearchAction, so search engines can
            surface a sitelinks search box for the app. */}
        <JsonLd
          data={{
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            name: SITE.name,
            url: SITE.url,
            potentialAction: {
              '@type': 'SearchAction',
              target: `${SITE.url}/search?q={search_term_string}`,
              'query-input': 'required name=search_term_string',
            },
          }}
        />
        {/* A client component wrapping server-rendered children. `children` is
            passed through as an already-rendered tree, so everything below stays a
            server component; only the provider itself ships to the browser. */}
        <MotionProvider>{children}</MotionProvider>
      </body>
    </html>
  );
}
