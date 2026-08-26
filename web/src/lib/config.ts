/** Site-wide constants used for SEO, metadata and canonical URLs. */

export const SITE = {
  name: 'MusicArea',
  tagline: 'Turn up your world',
  description:
    'Discover and stream music with a vivid player, fresh catalogue picks and listening preferences that stay on your device.',
  url: process.env.NEXT_PUBLIC_SITE_URL || 'https://musicarea.app',
} as const;

export interface LanguageOption {
  id: string;
  label: string;
  native: string;
  tint: string;
}

export const LANGUAGES: LanguageOption[] = [
  { id: 'hindi', label: 'Hindi', native: 'हिन्दी', tint: '#4b195d' },
  { id: 'english', label: 'English', native: 'English', tint: '#153a67' },
  { id: 'punjabi', label: 'Punjabi', native: 'ਪੰਜਾਬੀ', tint: '#6b291a' },
  { id: 'tamil', label: 'Tamil', native: 'தமிழ்', tint: '#1a4c46' },
  { id: 'telugu', label: 'Telugu', native: 'తెలుగు', tint: '#51371a' },
  { id: 'marathi', label: 'Marathi', native: 'मराठी', tint: '#3c2459' },
  { id: 'bengali', label: 'Bengali', native: 'বাংলা', tint: '#174c70' },
  { id: 'kannada', label: 'Kannada', native: 'ಕನ್ನಡ', tint: '#633046' },
  { id: 'malayalam', label: 'Malayalam', native: 'മലയാളം', tint: '#254168' },
  { id: 'gujarati', label: 'Gujarati', native: 'ગુજરાતી', tint: '#665018' },
  { id: 'bhojpuri', label: 'Bhojpuri', native: 'भोजपुरी', tint: '#523b74' },
  { id: 'urdu', label: 'Urdu', native: 'اردو', tint: '#0d4f5a' },
  { id: 'haryanvi', label: 'Haryanvi', native: 'हरियाणवी', tint: '#6a213f' },
  { id: 'rajasthani', label: 'Rajasthani', native: 'राजस्थानी', tint: '#664117' },
  { id: 'assamese', label: 'Assamese', native: 'অসমীয়া', tint: '#253d70' },
  { id: 'odia', label: 'Odia', native: 'ଓଡ଼ିଆ', tint: '#4e295f' },
];

export const LANGUAGE_IDS = LANGUAGES.map((l) => l.id);
export const DEFAULT_LANGUAGES = ['hindi'];

export const AVATARS: { id: string; tint: string }[] = [
  { id: 'violet', tint: '#8b5cf6' },
  { id: 'fuchsia', tint: '#ec4899' },
  { id: 'coral', tint: '#fb7185' },
  { id: 'amber', tint: '#f59e0b' },
  { id: 'cyan', tint: '#06b6d4' },
  { id: 'indigo', tint: '#6366f1' },
];

export const LANG_COOKIE = 'ma_langs';
