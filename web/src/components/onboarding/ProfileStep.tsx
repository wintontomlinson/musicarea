'use client';

import { useState } from 'react';
import { AVATARS } from '@/lib/config';
import { Avatar } from '@/components/ui/Avatar';
import { Icon } from '@/components/ui/Icon';

export function ProfileStep({ initialName, initialAvatar, onBack, onNext }: { initialName: string; initialAvatar: string; onBack: () => void; onNext: (name: string, avatar: string) => void }) {
  const [name, setName] = useState(initialName);
  const [avatar, setAvatar] = useState(initialAvatar || AVATARS[0].id);
  const trimmed = name.trim();
  const canContinue = trimmed.length > 0 && trimmed.length <= 30;

  return (
    <OnboardingShell step={3} title="Add a local profile" subtitle="This name stays on this device. No account is needed." onBack={onBack}>
      <div className="flex flex-col items-center gap-7">
        <Avatar name={trimmed || 'M'} avatarId={avatar} size={88} />
        <div className="w-full max-w-sm"><label htmlFor="profile-name" className="mb-2 block text-[13px] font-medium text-text-secondary">Display name</label><input id="profile-name" value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && canContinue) onNext(trimmed, avatar); }} maxLength={30} autoFocus placeholder="Your name" className="w-full rounded-lg border border-white/10 bg-black/20 px-4 py-3 text-center text-[17px] font-semibold outline-none transition-colors placeholder:text-text-muted focus:border-white/30" /></div>
        <div className="w-full max-w-sm"><p className="mb-3 text-center text-[13px] font-medium text-text-secondary">Choose an avatar colour</p><div className="flex flex-wrap justify-center gap-3">{AVATARS.map((item) => <button key={item.id} type="button" aria-label={`Avatar ${item.id}`} aria-pressed={avatar === item.id} onClick={() => setAvatar(item.id)} className={`grid h-11 w-11 place-items-center rounded-full transition ${avatar === item.id ? 'ring-2 ring-white ring-offset-2 ring-offset-bg' : 'hover:scale-105'}`} style={{ backgroundColor: item.tint }}>{avatar === item.id && <Icon name="check" size={18} />}</button>)}</div></div>
        <button type="button" disabled={!canContinue} onClick={() => onNext(trimmed, avatar)} className="button-primary w-full max-w-sm py-3 disabled:cursor-not-allowed disabled:opacity-40">Start listening <Icon name="play" size={15} /></button>
      </div>
    </OnboardingShell>
  );
}

export function OnboardingShell({ step, title, subtitle, onBack, children }: { step: 1 | 2 | 3; title: string; subtitle?: string; onBack?: () => void; children: React.ReactNode }) {
  return <div className="flex min-h-[100dvh] bg-bg px-5 py-8 sm:items-center sm:justify-center"><div className="w-full max-w-xl rounded-xl2 border border-white/12 bg-surface p-6 sm:p-8"><div className="mb-9 flex items-center justify-between">{onBack ? <button type="button" onClick={onBack} className="rounded-lg px-3 py-1.5 text-[14px] font-semibold text-text-secondary transition-colors hover:bg-white/10 hover:text-white">Back</button> : <span className="w-12" />}<div className="flex gap-1.5" aria-label={`Step ${step} of 3`}>{[1, 2, 3].map((number) => <span key={number} className={`h-1.5 rounded-full transition-all ${number <= step ? 'w-7 bg-white' : 'w-1.5 bg-white/20'}`} />)}</div><span className="w-12" /></div><div className="mb-8 text-center"><p className="text-[12px] text-text-secondary">Step {step} of 3</p><h1 className="mt-2 text-h3 font-extrabold tracking-[-0.035em] sm:text-h2">{title}</h1>{subtitle && <p className="mx-auto mt-3 max-w-md text-[14px] leading-relaxed text-text-secondary">{subtitle}</p>}</div>{children}</div></div>;
}
