'use client';

import { SITE } from '@/lib/config';
import { Icon } from '@/components/ui/Icon';

export function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-bg px-6 text-center">
      <div className="w-full max-w-md rounded-xl2 border border-white/12 bg-surface p-7 sm:p-10">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-xl bg-accent text-white"><Icon name="disc" size={27} /></span>
        <h1 className="mt-7 text-h2 font-extrabold tracking-[-0.04em] sm:text-h1">Welcome to {SITE.name}</h1>
        <p className="mx-auto mt-4 max-w-sm text-[15px] leading-relaxed text-text-secondary">First, tell us which languages you listen to. We will use them to choose the music shelves you see.</p>
        <button type="button" onClick={onNext} className="button-primary mt-8 w-full py-3">Choose languages <Icon name="chevronRight" size={17} /></button>
        <p className="mt-4 text-[11px] text-text-muted">You can edit preferences anytime. No account needed.</p>
      </div>
    </div>
  );
}
