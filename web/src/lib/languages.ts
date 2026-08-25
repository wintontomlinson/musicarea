import { cookies } from 'next/headers';
import { DEFAULT_LANGUAGES, LANG_COOKIE, LANGUAGE_IDS } from './config';

/**
 * Read the listener's preferred languages from the cookie the client mirrors on
 * every change, so server components SSR the feed for the right languages.
 * Falls back to the default when unset or invalid. Bounded to four to match the
 * Flask API's cap.
 */
export function preferredLanguages(): string[] {
  const raw = cookies().get(LANG_COOKIE)?.value;
  if (!raw) return DEFAULT_LANGUAGES;
  const langs = decodeURIComponent(raw)
    .split(',')
    .map((l) => l.trim().toLowerCase())
    .filter((l) => LANGUAGE_IDS.includes(l))
    .slice(0, 4);
  return langs.length ? langs : DEFAULT_LANGUAGES;
}
