'use client';

import { SITE } from '@/lib/config';
import { Icon } from '@/components/ui/Icon';

/** First onboarding screen: a branded, full-bleed intro with a single CTA. */
export function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <div className="relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden px-6 text-center">
      {/* Ambient brand wash */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            'radial-gradient(60% 50% at 30% 20%, rgba(255,77,109,0.28), transparent 60%), radial-gradient(55% 50% at 80% 80%, rgba(123,47,190,0.28), transparent 60%)',
        }}
      />
      <div className="noise absolute inset-0" aria-hidden="true" />

      <div className="relative flex flex-col items-center gap-6 animate-fade-up">
        <span className="grid h-16 w-16 place-items-center rounded-2xl bg-brand shadow-glow">
          <Icon name="play" size={30} className="text-white" />
        </span>

        <div>
          <h1 className="text-h1 font-extrabold tracking-tight">
            Welcome to <span className="text-gradient">{SITE.name}</span>
          </h1>
          <p className="mx-auto mt-3 max-w-md text-h5 text-text-secondary">
            {SITE.tagline}. Set up your profile and pick your languages, and your
            home starts shaping itself around you.
          </p>
        </div>

        <button
          type="button"
          onClick={onNext}
          className="mt-2 rounded-full bg-brand px-10 py-4 text-base font-bold text-white shadow-glow transition-transform duration-150 hover:scale-[1.03]"
        >
          Get Started
        </button>
      </div>
    </div>
  );
}
