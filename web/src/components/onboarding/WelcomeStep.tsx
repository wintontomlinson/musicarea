'use client';

import { SITE } from '@/lib/config';
import { Icon } from '@/components/ui/Icon';

export function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-bg px-6 text-center">
      <div aria-hidden="true" className="absolute inset-0 opacity-90" style={{ background: 'radial-gradient(circle at 20% 20%, rgba(255,77,109,0.25), transparent 35%), radial-gradient(circle at 80% 80%, rgba(139,92,246,0.22), transparent 38%)' }} />
      <div className="premium-panel relative w-full max-w-lg p-8 sm:p-12">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-brand text-white shadow-glow"><Icon name="play" size={29} /></span>
        <p className="eyebrow mt-7">Your music, your way</p>
        <h1 className="mt-2 text-h2 font-extrabold tracking-tight sm:text-h1">Welcome to {SITE.name}</h1>
        <p className="mx-auto mt-3 max-w-md text-base text-text-secondary">Create a local profile, choose your languages, then dive into music picked for you.</p>
        <button type="button" onClick={onNext} className="button-primary mt-8 px-9 py-3.5">Get started</button>
      </div>
    </div>
  );
}
