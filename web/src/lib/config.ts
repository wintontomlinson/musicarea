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
 * onboarding language-preference step. The gradient tints give each card its
 * own identity (Spotify/Apple style) without needing artwork.
 */
export interface LanguageOption {
  id: string;
  label: string;
  native: string;
  gradient: string;
}

export const LANGUAGES: LanguageOption[] = [
  { id: 'hindi', label: 'Hindi', native: 'हिन्दी', gradient: 'from-[#FF4D6D] to-[#7B2FBE]' },
  { id: 'english', label: 'English', native: 'English', gradient: 'from-[#2E7DFF] to-[#00C2A8]' },
  { id: 'punjabi', label: 'Punjabi', native: 'ਪੰਜਾਬੀ', gradient: 'from-[#FF8A3D] to-[#FF3D77]' },
  { id: 'tamil', label: 'Tamil', native: 'தமிழ்', gradient: 'from-[#00B4D8] to-[#0077B6]' },
  { id: 'telugu', label: 'Telugu', native: 'తెలుగు', gradient: 'from-[#9D4EDD] to-[#5A189A]' },
  { id: 'marathi', label: 'Marathi', native: 'मराठी', gradient: 'from-[#F72585] to-[#7209B7]' },
  { id: 'bengali', label: 'Bengali', native: 'বাংলা', gradient: 'from-[#06D6A0] to-[#118AB2]' },
  { id: 'kannada', label: 'Kannada', native: 'ಕನ್ನಡ', gradient: 'from-[#FFB703] to-[#FB8500]' },
  { id: 'malayalam', label: 'Malayalam', native: 'മലയാളം', gradient: 'from-[#43AA8B] to-[#264653]' },
  { id: 'gujarati', label: 'Gujarati', native: 'ગુજરાતી', gradient: 'from-[#EF476F] to-[#C1121F]' },
  { id: 'bhojpuri', label: 'Bhojpuri', native: 'भोजपुरी', gradient: 'from-[#F4A261] to-[#E76F51]' },
  { id: 'urdu', label: 'Urdu', native: 'اردو', gradient: 'from-[#118AB2] to-[#073B4C]' },
  { id: 'haryanvi', label: 'Haryanvi', native: 'हरियाणवी', gradient: 'from-[#8338EC] to-[#3A0CA3]' },
  { id: 'rajasthani', label: 'Rajasthani', native: 'राजस्थानी', gradient: 'from-[#FF6B6B] to-[#C9184A]' },
  { id: 'assamese', label: 'Assamese', native: 'অসমীয়া', gradient: 'from-[#2A9D8F] to-[#1D3557]' },
  { id: 'odia', label: 'Odia', native: 'ଓଡ଼ିଆ', gradient: 'from-[#E85D04] to-[#9D0208]' },
];

export const LANGUAGE_IDS = LANGUAGES.map((l) => l.id);
export const DEFAULT_LANGUAGES = ['hindi'];

/** Preset gradient avatars for the local profile (no photo upload). */
export const AVATARS: { id: string; gradient: string }[] = [
  { id: 'coral', gradient: 'from-[#FF4D6D] to-[#7B2FBE]' },
  { id: 'ocean', gradient: 'from-[#2E7DFF] to-[#00C2A8]' },
  { id: 'sunset', gradient: 'from-[#FF8A3D] to-[#FF3D77]' },
  { id: 'forest', gradient: 'from-[#06D6A0] to-[#118AB2]' },
  { id: 'gold', gradient: 'from-[#FFB703] to-[#FB8500]' },
  { id: 'violet', gradient: 'from-[#9D4EDD] to-[#5A189A]' },
];

/** Cookie the client mirrors preferred languages into so the server can SSR
 *  the feed for the right languages on first paint. */
export const LANG_COOKIE = 'ma_langs';

