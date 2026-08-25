/** Site-wide constants used for SEO, metadata and canonical URLs. */

export const SITE = {
  name: 'MusicArea',
  tagline: 'Music that learns what you love',
  description:
    'Stream millions of songs with a player that learns your taste. Discover new music, build playlists and listen free on MusicArea.',
  // The public origin of the deployed frontend. Overridden per environment.
  url: process.env.NEXT_PUBLIC_SITE_URL || 'https://musicarea.app',
} as const;

export const NAV_LANGUAGES = [
  'hindi',
  'english',
  'punjabi',
  'tamil',
  'telugu',
  'kannada',
  'bengali',
  'marathi',
] as const;
