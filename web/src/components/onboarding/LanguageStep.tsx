'use client';

import { useState } from 'react';
import { LANGUAGES } from '@/lib/config';
import { OnboardingShell } from './ProfileStep';

export function LanguageStep({
  initial,
  onBack,
  onFinish,
}: {
  initial: string[];
  onBack: () => void;
  onFinish: (languages: string[]) => void;
}) {
  const [selected, setSelected] = useState<string[]>(initial);

  function toggle(id: string) {
    setSelected((current) => (current.includes(id) ? current.filter((language) => language !== id) : [...current, id]));
  }

  return (
    <OnboardingShell
      step={3}
      title="What do you like to listen to?"
      subtitle="Choose one or more languages. You can update this anytime."
      onBack={onBack}
    >
      <div className="grid grid-cols-2 gap-x-6 sm:grid-cols-3">
        {LANGUAGES.map((language) => {
          const active = selected.includes(language.id);
          return (
            <button
              key={language.id}
              type="button"
              aria-pressed={active}
              onClick={() => toggle(language.id)}
              className={`border-b py-4 text-left text-base font-semibold transition-colors ${
                active ? 'border-white text-white' : 'border-subtle text-text-secondary hover:text-white'
              }`}
            >
              <span className="block">{language.label}</span>
              <span className="mt-1 block text-sm font-normal text-text-secondary">{language.native}</span>
            </button>
          );
        })}
      </div>
      <div className="mt-7 flex flex-col items-center gap-3">
        <p className="text-xs text-text-secondary" aria-live="polite">
          {selected.length ? `${selected.length} selected` : 'Select at least one language to continue'}
        </p>
        <button
          type="button"
          disabled={!selected.length}
          onClick={() => onFinish(selected)}
          className="button-primary w-full max-w-sm py-3 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Start listening
        </button>
      </div>
    </OnboardingShell>
  );
}
