'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/stores/user';
import { WelcomeStep } from './WelcomeStep';
import { ProfileStep } from './ProfileStep';
import { LanguageStep } from './LanguageStep';

/**
 * First-run setup.
 *
 * The application is always rendered, and setup is layered over it. That matters
 * for two reasons: the server can render real page content, so crawlers and the
 * first paint both get the catalogue rather than an empty shell, and a returning
 * listener never waits on a gate before seeing anything.
 *
 * Because localStorage is only readable on the client, the overlay appears after
 * hydration. An onboarded listener therefore never sees it at all, and a new one
 * sees it immediately after the first paint.
 */
export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const hydrated = useUser((s) => s.hydrated);
  const hydrate = useUser((s) => s.hydrate);
  const onboardingComplete = useUser((s) => s.onboardingComplete);
  const profile = useUser((s) => s.profile);
  const languages = useUser((s) => s.languages);
  const setProfile = useUser((s) => s.setProfile);
  const setLanguages = useUser((s) => s.setLanguages);
  const completeOnboarding = useUser((s) => s.completeOnboarding);
  const router = useRouter();

  const [step, setStep] = useState<1 | 2 | 3>(1);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const showSetup = hydrated && !onboardingComplete;

  // Hold the page still while setup is on top of it.
  useEffect(() => {
    if (!showSetup) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [showSetup]);

  function finish(name: string, avatar: string) {
    setProfile({ name, avatar });
    completeOnboarding();
    // Re-render server components so the feed matches the chosen languages. The
    // store has already mirrored them into the cookie the server reads.
    router.refresh();
  }

  return (
    <>
      {children}

      {showSetup && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Set up MusicArea"
          className="fixed inset-0 z-[90] overflow-y-auto bg-bg"
        >
          {step === 1 && <WelcomeStep onNext={() => setStep(2)} />}
          {step === 2 && (
            <LanguageStep
              initial={languages}
              onBack={() => setStep(1)}
              onNext={(selected) => {
                setLanguages(selected);
                setStep(3);
              }}
            />
          )}
          {step === 3 && (
            <ProfileStep
              initialName={profile?.name ?? ''}
              initialAvatar={profile?.avatar ?? ''}
              onBack={() => setStep(2)}
              onNext={finish}
            />
          )}
        </div>
      )}
    </>
  );
}
