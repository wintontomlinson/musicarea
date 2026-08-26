import { notify } from '@/stores/toast';

/**
 * Share a link using the Web Share API where the device supports it, falling
 * back to the clipboard. Both paths report the outcome through a toast so the
 * action is never silent. A cancelled share sheet is not an error.
 */
export async function shareLink(path: string, title: string) {
  const url =
    typeof window !== 'undefined' ? new URL(path, window.location.origin).toString() : path;

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ title, url });
      return;
    } catch (error) {
      // AbortError means the user dismissed the sheet: stop, do not fall back.
      if (error instanceof DOMException && error.name === 'AbortError') return;
    }
  }

  try {
    await navigator.clipboard.writeText(url);
    notify('Link copied');
  } catch {
    notify('Could not copy the link');
  }
}
