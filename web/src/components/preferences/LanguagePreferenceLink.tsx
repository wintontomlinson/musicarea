'use client';

import Link from 'next/link';
import { LANGUAGES } from '@/lib/config';
import { useUser } from '@/stores/user';
import { Icon } from '@/components/ui/Icon';

/**
 * Shows which listening languages are currently shaping the catalogue, with a
 * direct route to change them. Renders nothing until the local store hydrates,
 * so the server and client markup agree on first paint.
 */
export function LanguagePreferenceLink() {
  const hydrated = useUser((state) => state.hydrated);
  const languages = useUser((state) => state.languages);

  if (!hydrated) return null;

  const labels = languages
    .map((id) => LANGUAGES.find((language) => language.id === id)?.label)
    .filter((label): label is string => Boolean(label));

  return (
    <Link href="/settings#music-preferences" className="chip mt-4">
      <Icon name="grid" size={14} />
      <span className="text-text-muted">Languages</span>
      <span className="font-semibold text-text">
        {labels.length ? labels.join(', ') : 'Not set'}
      </span>
      <Icon name="chevronRight" size={13} className="text-text-muted" />
    </Link>
  );
}
