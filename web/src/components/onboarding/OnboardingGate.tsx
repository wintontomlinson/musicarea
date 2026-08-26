'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/stores/user';
import { WelcomeStep } from './WelcomeStep';
import { ProfileStep } from './ProfileStep';
import { LanguageStep } from './LanguageStep';

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

  useEffect(() => { hydrate(); }, [hydrate]);
  if (!hydrated) return <div className="min-h-[100dvh] bg-bg" aria-hidden="true" />;
  if (onboardingComplete) return <>{children}</>;

  function finish(name: string, avatar: string) {
    setProfile({ name, avatar });
    completeOnboarding();
    router.refresh();
  }

  return (
    <div className="min-h-[100dvh] bg-bg">
      {step === 1 && <WelcomeStep onNext={() => setStep(2)} />}
      {step === 2 && <LanguageStep initial={languages} onBack={() => setStep(1)} onNext={(selected) => { setLanguages(selected); setStep(3); }} />}
      {step === 3 && <ProfileStep initialName={profile?.name ?? ''} initialAvatar={profile?.avatar ?? ''} onBack={() => setStep(2)} onNext={finish} />}
    </div>
  );
}
