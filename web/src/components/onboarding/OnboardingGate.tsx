'use client';

import { useEffect } from 'react';
import { useUser } from '@/stores/user';

/**
 * Previously gated the app behind a first-run onboarding flow (welcome, profile,
 * language steps). Now it just hydrates the user store and renders children
 * immediately, so the app loads without any setup screen.
 */
export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const hydrated = useUser((s) => s.hydrated);
  const hydrate = useUser((s) => s.hydrate);
  const onboardingComplete = useUser((s) => s.onboardingComplete);
  const completeOnboarding = useUser((s) => s.completeOnboarding);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // Auto-complete onboarding for any user so the flow never triggers again.
  useEffect(() => {
    if (hydrated && !onboardingComplete) {
      completeOnboarding();
    }
  }, [hydrated, onboardingComplete, completeOnboarding]);

  // Show nothing until client store is ready (avoids hydration mismatch).
  if (!hydrated) {
    return <div className="min-h-[100dvh] bg-bg" aria-hidden="true" />;
  }

  return <>{children}</>;
}
