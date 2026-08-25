'use client';

import { SITE } from '@/lib/config';
import { Icon } from '@/components/ui/Icon';

/** First onboarding screen: Apple's centred intro with a single tinted action. */
export function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-bg px-6 text-center">
      <div className="w-full max-w-md">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-xl2 bg-accent text-white shadow-lift">
          <Icon name="play" size={30} />
        </span>
        <h1 className="mt-7 text-h2 font-bold tracking-tight sm:text-h1">Welcome to {SITE.name}</h1>
        <p className="mx-auto mt-3 max-w-sm text-[15px] leading-relaxed text-text-secondary">
          Create a profile on this device and choose the languages you listen to. Your Listen Now
          feed builds itself around them.
        </p>
        <button type="button" onClick={onNext} className="button-primary mt-8 w-full py-3">
          Get Started
        </button>
      </div>
    </div>
  );
}
