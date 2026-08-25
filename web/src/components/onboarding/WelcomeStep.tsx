'use client';

import { SITE } from '@/lib/config';
import { Icon } from '@/components/ui/Icon';

export function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-bg px-6 text-center">
      <div className="surface-card w-full max-w-lg p-8 sm:p-12">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-xl bg-accent text-white">
          <Icon name="play" size={26} />
        </span>
        <h1 className="mt-6 text-h2 font-extrabold tracking-tight sm:text-h1">Welcome to {SITE.name}</h1>
        <p className="mx-auto mt-3 max-w-md text-base text-text-secondary">
          Set up your profile and choose your languages. Your Home feed will start with music that fits you.
        </p>
        <button type="button" onClick={onNext} className="button-primary mt-7 px-8 py-3">
          Get started
        </button>
      </div>
    </div>
  );
}
