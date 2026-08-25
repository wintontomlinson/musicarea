/** Site-wide constants used for SEO, metadata and canonical URLs. */

export const SITE = {
  name: 'MusicArea',
  tagline: 'Music that learns what you love',
  description:
    'Stream millions of songs with a player that learns your taste. Discover new music, build playlists and listen free on MusicArea.',
  // The public origin of the deployed frontend. Overridden per environment.
  url: process.env.NEXT_PUBLIC_SITE_URL || 'https://musicarea.app',
} as const;

/**
 * The languages the Flask catalogue supports, with display metadata for the
 * onboarding language-preference step. Tints are neutral greys: the interface
 * stays colourless and selection is shown with a white border instead.
 */
export interface LanguageOption {
  id: string;
  label: string;
  native: string;
  tint: string;
}

export const LANGUAGES: LanguageOption[] = [
  { id: 'hindi', label: 'Hindi', native: 'हिन्दी', tint: '#242424' },
  { id: 'english', label: 'English', native: 'English', tint: '#1F1F1F' },
  { id: 'punjabi', label: 'Punjabi', native: 'ਪੰਜਾਬੀ', tint: '#262626' },
  { id: 'tamil', label: 'Tamil', native: 'தமிழ்', tint: '#1D1D1D' },
  { id: 'telugu', label: 'Telugu', native: 'తెలుగు', tint: '#232323' },
  { id: 'marathi', label: 'Marathi', native: 'मराठी', tint: '#1E1E1E' },
  { id: 'bengali', label: 'Bengali', native: 'বাংলা', tint: '#252525' },
  { id: 'kannada', label: 'Kannada', native: 'ಕನ್ನಡ', tint: '#202020' },
  { id: 'malayalam', label: 'Malayalam', native: 'മലയാളം', tint: '#272727' },
  { id: 'gujarati', label: 'Gujarati', native: 'ગુજરાતી', tint: '#1C1C1C' },
  { id: 'bhojpuri', label: 'Bhojpuri', native: 'भोजपुरी', tint: '#242424' },
  { id: 'urdu', label: 'Urdu', native: 'اردو', tint: '#1F1F1F' },
  { id: 'haryanvi', label: 'Haryanvi', native: 'हरियाणवी', tint: '#262626' },
  { id: 'rajasthani', label: 'Rajasthani', native: 'राजस्थानी', tint: '#1D1D1D' },
  { id: 'assamese', label: 'Assamese', native: 'অসমীয়া', tint: '#232323' },
  { id: 'odia', label: 'Odia', native: 'ଓଡ଼ିଆ', tint: '#1E1E1E' },
];

export const LANGUAGE_IDS = LANGUAGES.map((l) => l.id);
export const DEFAULT_LANGUAGES = ['hindi'];

/** Preset avatars for the local profile (no photo upload). Neutral greys of
 *  differing lightness, so they stay distinguishable without colour. */
export const AVATARS: { id: string; tint: string }[] = [
  { id: 'graphite', tint: '#2E2E2E' },
  { id: 'slate', tint: '#3D3D3D' },
  { id: 'ash', tint: '#4C4C4C' },
  { id: 'stone', tint: '#5B5B5B' },
  { id: 'silver', tint: '#6A6A6A' },
  { id: 'pearl', tint: '#7A7A7A' },
];

/** Cookie the client mirrors preferred languages into so the server can SSR
 *  the feed for the right languages on first paint. */
export const LANG_COOKIE = 'ma_langs';

