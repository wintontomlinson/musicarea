'use client';

import { SITE } from '@/lib/config';
import { Icon } from '@/components/ui/Icon';

export function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-bg px-6 text-center">
      <div className="w-full max-w-lg">
        <Icon name="play" size={25} className="mx-auto text-accent" />
        <h1 className="mt-5 text-h2 font-extrabold tracking-tight sm:text-h1">{SITE.name}</h1>
        <p className="mx-auto mt-3 max-w-md text-base text-text-secondary">
          Create your profile and choose the music you want to hear.
        </p>
        <button type="button" onClick={onNext} className="button-primary mt-7 px-8 py-3">
          Continue
        </button>
      </div>
    </div>
  );
}
