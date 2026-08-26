'use client';

import { useState } from 'react';
import { LANGUAGES } from '@/lib/config';
import { OnboardingShell } from './ProfileStep';
import { Icon } from '@/components/ui/Icon';

export function LanguageStep({ initial, onBack, onFinish }: { initial: string[]; onBack: () => void; onFinish: (languages: string[]) => void }) {
  const [selected, setSelected] = useState<string[]>(initial);
  function toggle(id: string) { setSelected((current) => current.includes(id) ? current.filter((language) => language !== id) : [...current, id]); }
  return <OnboardingShell step={3} title="Choose your sound" subtitle="Pick the languages you enjoy. They guide the catalogue shelves you see first." onBack={onBack}><div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{LANGUAGES.map((language) => { const active = selected.includes(language.id); return <button key={language.id} type="button" aria-pressed={active} onClick={() => toggle(language.id)} style={{ backgroundColor: active ? language.tint : undefined }} className={`relative flex aspect-[16/10] flex-col justify-between overflow-hidden rounded-card border p-3 text-left transition ${active ? 'border-cyan-200/80 shadow-cyan' : 'border-white/10 bg-white/[0.04] hover:border-white/30'}`}><span className="text-[16px] font-extrabold leading-tight">{language.label}</span><span className="text-[12px] text-white/70">{language.native}</span>{active && <span className="absolute right-2 top-2 grid h-5 w-5 place-items-center rounded-full bg-cyan-200 text-violet-950"><Icon name="check" size={13} /></span>}</button>; })}</div><div className="mt-8 flex flex-col items-center gap-3"><p className="text-[12px] text-text-secondary" aria-live="polite">{selected.length ? `${selected.length} selected` : 'Select at least one language to continue'}</p><button type="button" disabled={!selected.length} onClick={() => onFinish(selected)} className="button-primary w-full max-w-sm py-3 disabled:cursor-not-allowed disabled:opacity-40"><Icon name="disc" size={17} />Start listening</button></div></OnboardingShell>;
}
