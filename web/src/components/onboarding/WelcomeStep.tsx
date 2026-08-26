'use client';

import { SITE } from '@/lib/config';
import { Icon } from '@/components/ui/Icon';

export function WelcomeStep({ onNext }: { onNext: () => void }) {
  return <div className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-bg px-6 text-center"><div className="absolute -left-32 top-8 h-72 w-72 rounded-full bg-accent/20 blur-3xl" /><div className="absolute -right-32 bottom-6 h-72 w-72 rounded-full bg-accent-alt/15 blur-3xl" /><div className="relative w-full max-w-md rounded-xl2 border border-white/15 bg-surface-raised/70 p-7 shadow-glow-lg backdrop-blur-xl sm:p-10"><span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-brand text-on-accent shadow-glow"><Icon name="disc" size={31} /></span><p className="section-kicker mt-7">Welcome to the listening room</p><h1 className="mt-2 text-h2 font-extrabold tracking-[-0.04em] sm:text-h1">Welcome to <span className="headline-gradient">{SITE.name}</span></h1><p className="mx-auto mt-4 max-w-sm text-[15px] leading-relaxed text-text-secondary">Create a profile for this device, choose your languages, then turn your first queue into a moment.</p><button type="button" onClick={onNext} className="button-primary mt-8 w-full py-3"><Icon name="sparkle" size={17} />Set the vibe</button><p className="mt-4 text-[11px] text-text-muted">No account needed. Your choices stay local to this device.</p></div></div>;
}
