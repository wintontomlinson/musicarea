'use client';

import Link from 'next/link';
import { LANGUAGES } from '@/lib/config';
import { useUser } from '@/stores/user';

export function LanguagePreferenceLink() {
  const hydrated = useUser((state) => state.hydrated);
  const languages = useUser((state) => state.languages);
  const labels = languages
    .map((id) => LANGUAGES.find((language) => language.id === id)?.label)
    .filter((label): label is string => Boolean(label));

  if (!hydrated) return null;

  return (
    <Link
      href="/settings#music-preferences"
      className="mt-4 inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-[13px] transition-colors hover:bg-white/[0.08]"
    >
      <span className="text-text-secondary">Music preferences</span>
      <span className="font-semibold text-white">{labels.length ? labels.join(', ') : 'Choose languages'}</span>
      <span className="text-text-muted">Edit</span>
    </Link>
  );
}
