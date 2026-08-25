'use client';

import { useState } from 'react';
import { LANGUAGES } from '@/lib/config';
import { OnboardingShell } from './ProfileStep';
import { Icon } from '@/components/ui/Icon';

/**
 * Third step: pick your languages, Spotify style. A grid of tinted language
 * cards, multi-select, at least one required to finish. The selection feeds the
 * home and search feeds.
 */
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
    setSelected((prev) => (prev.includes(id) ? prev.filter((l) => l !== id) : [...prev, id]));
  }

  const canFinish = selected.length > 0;

  return (
    <OnboardingShell
      step={3}
      title="What do you like to listen to?"
      subtitle="Choose the languages you enjoy. You can change these anytime."
      onBack={onBack}
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {LANGUAGES.map((lang) => {
          const active = selected.includes(lang.id);
          return (
            <button
              key={lang.id}
              type="button"
              aria-pressed={active}
              onClick={() => toggle(lang.id)}
              className={`group relative flex aspect-[16/10] flex-col justify-between overflow-hidden rounded-card bg-gradient-to-br p-3 text-left transition-transform duration-150 hover:scale-[1.02] ${lang.gradient} ${
                active ? 'ring-2 ring-white ring-offset-2 ring-offset-bg' : ''
              }`}
            >
              <span className="text-lg font-extrabold leading-tight text-white drop-shadow">
                {lang.label}
              </span>
              <span className="text-sm font-semibold text-white/85">{lang.native}</span>

              {active && (
                <span className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-white text-black">
                  <Icon name="play" size={12} />
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="sticky bottom-0 mt-8 flex flex-col items-center gap-2 bg-gradient-to-t from-bg to-transparent pb-2 pt-4">
        <p className="text-xs text-text-secondary" aria-live="polite">
          {selected.length
            ? `${selected.length} selected`
            : 'Select at least one language to continue'}
        </p>
        <button
          type="button"
          disabled={!canFinish}
          onClick={() => onFinish(selected)}
          className="w-full max-w-sm rounded-full bg-brand px-8 py-3.5 text-base font-bold text-white shadow-glow transition-transform duration-150 enabled:hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
        >
          Start Listening
        </button>
      </div>
    </OnboardingShell>
  );
}
