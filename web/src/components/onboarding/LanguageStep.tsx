'use client';

import { useState } from 'react';
import { LANGUAGES } from '@/lib/config';
import { OnboardingShell } from './ProfileStep';
import { Icon } from '@/components/ui/Icon';

export function LanguageStep({ initial, onBack, onFinish }: { initial: string[]; onBack: () => void; onFinish: (languages: string[]) => void; }) {
  const [selected, setSelected] = useState<string[]>(initial);
  function toggle(id: string) { setSelected((current) => current.includes(id) ? current.filter((language) => language !== id) : [...current, id]); }
  return (
    <OnboardingShell step={3} title="What do you like to listen to?" subtitle="Choose the languages you enjoy. We will shape your first Home feed around them." onBack={onBack}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{LANGUAGES.map((language) => { const active = selected.includes(language.id); return <button key={language.id} type="button" aria-pressed={active} onClick={() => toggle(language.id)} className={`group relative flex aspect-[16/10] flex-col justify-between overflow-hidden rounded-card bg-gradient-to-br p-3 text-left transition-transform hover:scale-[1.02] ${language.gradient} ${active ? 'ring-2 ring-white ring-offset-2 ring-offset-bg' : ''}`}><span className="text-lg font-extrabold leading-tight text-white drop-shadow">{language.label}</span><span className="text-sm font-semibold text-white/85">{language.native}</span>{active && <span className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-white text-black"><Icon name="play" size={12} /></span>}</button>; })}</div>
      <div className="mt-8 flex flex-col items-center gap-3"><p className="text-xs text-text-secondary" aria-live="polite">{selected.length ? `${selected.length} selected` : 'Select at least one language to continue'}</p><button type="button" disabled={!selected.length} onClick={() => onFinish(selected)} className="button-primary w-full max-w-sm py-3.5 disabled:cursor-not-allowed disabled:opacity-40">Start listening</button></div>
    </OnboardingShell>
  );
}
