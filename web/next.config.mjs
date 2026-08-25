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
  // The Flask API base is read at build and request time. Kept here so a single
  // env var drives every fetch and the value is obvious in one place.
  env: {
    NEXT_PUBLIC_APP_NAME: 'MusicArea',
  },
};

export default nextConfig;
