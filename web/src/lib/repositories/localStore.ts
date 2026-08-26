/**
 * Thin, typed wrapper around localStorage.
 *
 * Every read is defensive: storage can be unavailable (private mode, disabled
 * cookies, quota exceeded) and its contents can be stale or hand-edited. A bad
 * value must never crash the application, so failures fall back to the caller's
 * default instead of throwing.
 *
 * Keeping this separate from the stores means the persistence mechanism can be
 * swapped later without touching state or interface code.
 */

export function readJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as unknown;
    return (parsed ?? fallback) as T;
  } catch {
    return fallback;
  }
}

export function writeJson(key: string, value: unknown): boolean {
  if (typeof window === 'undefined') return false;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function removeKey(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* nothing to do: the key is already unreachable */
  }
}
