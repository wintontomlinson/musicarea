'use client';

import { useState } from 'react';
import { LANGUAGES } from '@/lib/config';
import { OnboardingShell } from './ProfileStep';
import { Icon } from '@/components/ui/Icon';

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
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {LANGUAGES.map((language) => {
          const active = selected.includes(language.id);
          return (
            <button
              key={language.id}
              type="button"
              aria-pressed={active}
              onClick={() => toggle(language.id)}
              className={`relative flex aspect-[16/10] flex-col justify-between rounded-card border p-3 text-left transition-colors ${
                active ? 'border-accent bg-accent/15' : 'border-subtle bg-surface-raised hover:bg-white/5'
              }`}
            >
              <span className="text-lg font-bold leading-tight">{language.label}</span>
              <span className="text-sm text-text-secondary">{language.native}</span>
              {active && (
                <span className="absolute right-2 top-2 grid h-5 w-5 place-items-center rounded-full bg-accent text-white">
                  <Icon name="play" size={10} />
                </span>
              )}
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
