'use client';

import { useState } from 'react';
import { LANGUAGES } from '@/lib/config';
import { OnboardingShell } from './ProfileStep';
import { Icon } from '@/components/ui/Icon';

export function LanguageStep({ initial, onBack, onNext }: { initial: string[]; onBack: () => void; onNext: (languages: string[]) => void }) {
  const [selected, setSelected] = useState<string[]>(initial);
  function toggle(id: string) {
    setSelected((current) => current.includes(id) ? current.filter((language) => language !== id) : [...current, id]);
  }

  return (
    <OnboardingShell step={2} title="What do you listen to?" subtitle="Choose one or more languages. We use these choices to select the catalogue shelves you see first." onBack={onBack}>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {LANGUAGES.map((language) => {
          const active = selected.includes(language.id);
          return (
            <button
              key={language.id}
              type="button"
              aria-pressed={active}
              onClick={() => toggle(language.id)}
              className={`relative flex aspect-[16/10] flex-col justify-between rounded-card border p-3 text-left transition-colors ${active ? 'border-white/40 bg-white/[0.12]' : 'border-white/10 bg-white/[0.03] hover:border-white/25'}`}
            >
              <span className="text-[16px] font-bold leading-tight">{language.label}</span>
              <span className="text-[12px] text-text-secondary">{language.native}</span>
              {active && <span className="absolute right-2 top-2 text-white"><Icon name="check" size={16} /></span>}
            </button>
          );
        })}
      </div>
      <div className="mt-7 flex flex-col items-center gap-3">
        <p className="text-[13px] text-text-secondary" aria-live="polite">{selected.length ? `${selected.length} ${selected.length === 1 ? 'language' : 'languages'} selected` : 'Select at least one language to continue'}</p>
        <button type="button" disabled={!selected.length} onClick={() => onNext(selected)} className="button-primary w-full max-w-sm py-3 disabled:cursor-not-allowed disabled:opacity-40">Continue <Icon name="chevronRight" size={16} /></button>
        <p className="text-center text-[11px] text-text-muted">You can change these anytime in Settings.</p>
      </div>
    </OnboardingShell>
  );
}
