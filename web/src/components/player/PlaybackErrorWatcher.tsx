'use client';

import { useEffect } from 'react';
import { usePlayer } from '@/stores/player';
import { notify } from '@/stores/toast';

/**
 * Surfaces playback failures as a toast instead of a console message, then
 * clears the flag so the same failure is not announced twice. Headless.
 */
export function PlaybackErrorWatcher() {
  const error = usePlayer((s) => s.error);
  const setError = usePlayer((s) => s.setError);

  useEffect(() => {
    if (!error) return;
    notify(error);
    const timer = window.setTimeout(() => setError(null), 100);
    return () => window.clearTimeout(timer);
  }, [error, setError]);

  return null;
}
