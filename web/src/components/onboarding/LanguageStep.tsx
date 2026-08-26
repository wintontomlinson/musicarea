'use client';

import { useState } from 'react';
import { LANGUAGES } from '@/lib/config';
import { OnboardingShell } from './ProfileStep';
import { Icon } from '@/components/ui/Icon';

/**
 * First real choice: which languages to hear. Multi-select, at least one
 * required, and the effect is stated plainly rather than dressed up as
 * personalisation the app does not perform.
 */
export function LanguageStep({
  initial,
  onBack,
  onNext,
}: {
  initial: string[];
  onBack: () => void;
  onNext: (languages: string[]) => void;
}) {
  const [selected, setSelected] = useState<string[]>(initial);

  function toggle(id: string) {
    setSelected((current) =>
      current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id],
    );
  }

  return (
    <OnboardingShell
      step={2}
      title="What do you listen to?"
      subtitle="Pick one or more languages. These choose which catalogue shelves you see on Home and Explore."
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
              className={`relative rounded border p-3.5 text-left transition-colors duration-fast ${
                active
                  ? 'border-strong bg-white/10'
                  : 'border-subtle bg-white/[0.03] hover:border-strong'
              }`}
            >
              <span className="block text-body font-semibold">{language.label}</span>
              <span className="mt-0.5 block text-micro text-text-secondary">{language.native}</span>
              {active && (
                <span className="absolute right-2 top-2 text-accent">
                  <Icon name="check" size={15} />
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-8 flex flex-col items-center gap-3">
        <p className="text-meta text-text-secondary" aria-live="polite">
          {selected.length
            ? `${selected.length} ${selected.length === 1 ? 'language' : 'languages'} selected`
            : 'Select at least one language to continue'}
        </p>
        <button
          type="button"
          disabled={!selected.length}
          onClick={() => onNext(selected)}
          className="btn-primary w-full max-w-sm py-3"
        >
          Continue
          <Icon name="chevronRight" size={15} />
        </button>
        <p className="text-micro text-text-muted">You can change this later in Settings.</p>
      </div>
    </OnboardingShell>
  );
}
