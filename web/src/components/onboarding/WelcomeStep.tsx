'use client';

import { SITE } from '@/lib/config';
import { Icon } from '@/components/ui/Icon';

/** Opening screen. One statement of what happens next, one action. */
export function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-bg px-6">
      <div className="w-full max-w-md text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-lg bg-accent text-white">
          <Icon name="disc" size={26} />
        </span>

        <h1 className="mt-8 text-title font-bold tracking-[-0.026em]">
          Welcome to {SITE.name}
        </h1>
        <p className="mx-auto mt-3.5 max-w-sm text-body leading-relaxed text-text-secondary">
          Tell us which languages you listen to, and we will use them to choose what appears first.
          Two short steps.
        </p>

        <button type="button" onClick={onNext} className="btn-primary mt-8 w-full py-3">
          Get started
          <Icon name="chevronRight" size={15} />
        </button>

        <p className="mt-4 text-micro text-text-muted">
          No account needed. Everything stays in this browser.
        </p>
      </div>
    </div>
  );
}
