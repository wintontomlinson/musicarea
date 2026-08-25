'use client';

import { SITE } from '@/lib/config';
import { Icon } from '@/components/ui/Icon';

/** First onboarding screen: a plain neutral intro with a single action. */
export function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-bg px-6 text-center">
      <div className="surface-card w-full max-w-lg p-8 sm:p-12">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-xl bg-white text-black">
          <Icon name="play" size={26} />
        </span>
        <p className="eyebrow mt-7">Your music, your way</p>
        <h1 className="mt-2 text-h2 font-extrabold tracking-tight sm:text-h1">
          Welcome to {SITE.name}
        </h1>
        <p className="mx-auto mt-3 max-w-md text-base text-text-secondary">
          Create a local profile, choose your languages, then dive into music picked for you.
        </p>
        <button type="button" onClick={onNext} className="button-primary mt-8 px-9 py-3.5">
          Get started
        </button>
      </div>
    </div>
  );
}
