'use client';

import { useState } from 'react';
import { AVATARS } from '@/lib/config';
import { Avatar } from '@/components/ui/Avatar';

/**
 * Second step: create a local profile. Pick a display name and a gradient
 * avatar. No account, no upload; it lives in localStorage. Continue is disabled
 * until a non-empty name is entered.
 */
export function ProfileStep({
  initialName,
  initialAvatar,
  onBack,
  onNext,
}: {
  initialName: string;
  initialAvatar: string;
  onBack: () => void;
  onNext: (name: string, avatar: string) => void;
}) {
  const [name, setName] = useState(initialName);
  const [avatar, setAvatar] = useState(initialAvatar || AVATARS[0].id);
  const trimmed = name.trim();
  const canContinue = trimmed.length > 0 && trimmed.length <= 30;

  return (
    <OnboardingShell
      step={2}
      title="Create your profile"
      subtitle="This is just for you, stored on this device. No account needed."
      onBack={onBack}
    >
      <div className="flex flex-col items-center gap-8">
        <Avatar name={trimmed || 'M'} avatarId={avatar} size={96} className="shadow-lift" />

        <div className="w-full max-w-sm">
          <label htmlFor="profile-name" className="mb-2 block text-sm font-semibold text-text-secondary">
            What should we call you?
          </label>
          <input
            id="profile-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && canContinue) onNext(trimmed, avatar);
            }}
            maxLength={30}
            autoFocus
            placeholder="Your name"
            className="w-full rounded-full border border-subtle bg-surface-raised/80 px-5 py-3.5 text-center text-lg font-semibold outline-none transition-colors duration-150 placeholder:text-text-muted focus:border-accent/60"
          />
        </div>

        <div className="w-full max-w-sm">
          <p className="mb-3 text-center text-sm font-semibold text-text-secondary">Pick an avatar</p>
          <div className="flex flex-wrap justify-center gap-3">
            {AVATARS.map((a) => (
              <button
                key={a.id}
                type="button"
                aria-label={`Avatar ${a.id}`}
                aria-pressed={avatar === a.id}
                onClick={() => setAvatar(a.id)}
                className={`rounded-full transition-transform duration-150 hover:scale-105 ${
                  avatar === a.id ? 'ring-2 ring-accent ring-offset-2 ring-offset-bg' : ''
                }`}
              >
                <span
                  className={`block h-12 w-12 rounded-full bg-gradient-to-br ${a.gradient}`}
                  aria-hidden="true"
                />
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          disabled={!canContinue}
          onClick={() => onNext(trimmed, avatar)}
          className="mt-2 w-full max-w-sm rounded-full bg-brand px-8 py-3.5 text-base font-bold text-white shadow-glow transition-transform duration-150 enabled:hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
        >
          Continue
        </button>
      </div>
    </OnboardingShell>
  );
}

/** Shared frame for onboarding steps: progress dots, back link, title. */
export function OnboardingShell({
  step,
  title,
  subtitle,
  onBack,
  children,
}: {
  step: 1 | 2 | 3;
  title: string;
  subtitle?: string;
  onBack?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-[100dvh] flex-col px-6 py-8">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            'radial-gradient(50% 45% at 20% 10%, rgba(255,77,109,0.2), transparent 60%), radial-gradient(50% 45% at 85% 90%, rgba(123,47,190,0.2), transparent 60%)',
        }}
      />
      <div className="relative mx-auto flex w-full max-w-xl flex-1 flex-col">
        <div className="mb-8 flex items-center justify-between">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="text-sm font-semibold text-text-secondary hover:text-white"
            >
              &larr; Back
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-1.5" aria-label={`Step ${step} of 3`}>
            {[1, 2, 3].map((n) => (
              <span
                key={n}
                className={`h-1.5 rounded-full transition-all duration-200 ${
                  n === step ? 'w-6 bg-accent' : 'w-1.5 bg-white/20'
                }`}
              />
            ))}
          </div>
          <span className="w-10" />
        </div>

        <div className="mb-8 text-center animate-fade-up">
          <h1 className="text-h2 font-extrabold tracking-tight">{title}</h1>
          {subtitle && <p className="mx-auto mt-2 max-w-md text-sm text-text-secondary">{subtitle}</p>}
        </div>

        <div className="flex-1 animate-fade-up">{children}</div>
      </div>
    </div>
  );
}
