'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/stores/user';
import { WelcomeStep } from './WelcomeStep';
import { ProfileStep } from './ProfileStep';
import { LanguageStep } from './LanguageStep';

/**
 * Gates the app behind the first-run flow. Until onboarding is complete it shows
 * Welcome then Profile then Language; once complete (or for returning users) it
 * renders the app. Nothing is shown until the store hydrates from localStorage,
 * so an onboarded user never sees a flash of the flow.
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

  // Avoid hydration mismatch: render nothing until the client store is ready.
  if (!hydrated) {
    return <div className="min-h-[100dvh] bg-bg" aria-hidden="true" />;
  }

  if (onboardingComplete) {
    return <>{children}</>;
  }

  function finish(langs: string[]) {
    setLanguages(langs);
    completeOnboarding();
    // Refresh so server components re-fetch the feed for the chosen languages
    // (the store also wrote the language cookie the server reads).
    router.refresh();
  }

  return (
    <div className="min-h-[100dvh] bg-bg">
      {step === 1 && <WelcomeStep onNext={() => setStep(2)} />}
      {step === 2 && (
        <ProfileStep
          initialName={profile?.name ?? ''}
          initialAvatar={profile?.avatar ?? ''}
          onBack={() => setStep(1)}
          onNext={(name, avatar) => {
            setProfile({ name, avatar });
            setStep(3);
          }}
        />
      )}
      {step === 3 && (
        <LanguageStep
          initial={languages}
          onBack={() => setStep(2)}
          onFinish={finish}
        />
      )}
    </div>
  );
}
