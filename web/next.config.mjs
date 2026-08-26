/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // Album art and artist images are served from the JioSaavn CDN. Next/Image
    // needs the remote host allow-listed to optimize and lazy-load them.
    remotePatterns: [
      { protocol: 'https', hostname: 'c.saavncdn.com' },
      { protocol: 'https', hostname: '*.saavncdn.com' },
      // The Flask API serves some mood/genre cover art from Unsplash.
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
  },
  // Note: the Flask API base is NOT configured here. It is read from
  // `FLASK_API_BASE` inside `src/lib/api.ts` at request time, deliberately
  // without a `NEXT_PUBLIC_` prefix so the internal service URL never reaches
  // the browser bundle. Client-side calls go through the route handlers under
  // `src/app/api/` instead.
};

export default nextConfig;
