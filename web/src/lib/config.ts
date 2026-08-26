/** Site-wide constants used for SEO, metadata and canonical URLs. */

export const SITE = {
  name: 'MusicArea',
  tagline: 'Music worth staying for',
  description:
    'Stream songs, albums, artists and playlists with a fast, focused player. Build a queue, keep your favourites and pick the languages you listen to.',
  url: process.env.NEXT_PUBLIC_SITE_URL || 'https://musicarea.app',
} as const;

export interface LanguageOption {
  id: string;
  label: string;
  native: string;
  tint: string;
}

export const LANGUAGES: LanguageOption[] = [
  { id: 'hindi', label: 'Hindi', native: 'हिन्दी', tint: '#2A2430' },
  { id: 'english', label: 'English', native: 'English', tint: '#1F2833' },
  { id: 'punjabi', label: 'Punjabi', native: 'ਪੰਜਾਬੀ', tint: '#33241F' },
  { id: 'tamil', label: 'Tamil', native: 'தமிழ்', tint: '#1F2E2C' },
  { id: 'telugu', label: 'Telugu', native: 'తెలుగు', tint: '#2E2820' },
  { id: 'marathi', label: 'Marathi', native: 'मराठी', tint: '#26222F' },
  { id: 'bengali', label: 'Bengali', native: 'বাংলা', tint: '#1E2A33' },
  { id: 'kannada', label: 'Kannada', native: 'ಕನ್ನಡ', tint: '#2F2429' },
  { id: 'malayalam', label: 'Malayalam', native: 'മലയാളം', tint: '#222833' },
  { id: 'gujarati', label: 'Gujarati', native: 'ગુજરાતી', tint: '#2E2C1F' },
  { id: 'bhojpuri', label: 'Bhojpuri', native: 'भोजपुरी', tint: '#282331' },
  { id: 'urdu', label: 'Urdu', native: 'اردو', tint: '#1E2B2E' },
  { id: 'haryanvi', label: 'Haryanvi', native: 'हरियाणवी', tint: '#32232A' },
  { id: 'rajasthani', label: 'Rajasthani', native: 'राजस्थानी', tint: '#2F2921' },
  { id: 'assamese', label: 'Assamese', native: 'অসমীয়া', tint: '#212734' },
  { id: 'odia', label: 'Odia', native: 'ଓଡ଼ିଆ', tint: '#2B2431' },
];

export const LANGUAGE_IDS = LANGUAGES.map((l) => l.id);
export const DEFAULT_LANGUAGES = ['hindi'];

/**
 * Preset avatar tints for the local profile. Muted rather than saturated, so a
 * profile chip never competes with album artwork.
 */
export const AVATARS: { id: string; tint: string; label: string }[] = [
  { id: 'graphite', tint: '#3A3A3C', label: 'Graphite' },
  { id: 'indigo', tint: '#3D4468', label: 'Indigo' },
  { id: 'teal', tint: '#26514E', label: 'Teal' },
  { id: 'clay', tint: '#5C3B33', label: 'Clay' },
  { id: 'rose', tint: '#5E2E3C', label: 'Rose' },
  { id: 'olive', tint: '#43492E', label: 'Olive' },
];

export const LANG_COOKIE = 'ma_langs';
