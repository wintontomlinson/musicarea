'use client';

import { useState } from 'react';
import { AVATARS } from '@/lib/config';
import { Avatar } from '@/components/ui/Avatar';

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
      subtitle="This stays on this device. No account needed."
      onBack={onBack}
    >
      <div className="flex flex-col items-center gap-7">
        <Avatar name={trimmed || 'M'} avatarId={avatar} size={72} />
        <div className="w-full max-w-sm">
          <label htmlFor="profile-name" className="mb-2 block text-sm font-semibold text-text-secondary">
            What should we call you?
          </label>
          <input
            id="profile-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && canContinue) onNext(trimmed, avatar);
            }}
            maxLength={30}
            autoFocus
            placeholder="Your name"
            className="w-full border-b border-subtle bg-transparent px-2 py-3 text-center text-lg font-semibold outline-none transition-colors placeholder:text-text-muted focus:border-white"
          />
        </div>
        <div className="w-full max-w-sm">
          <p className="mb-3 text-center text-sm font-semibold text-text-secondary">Choose an avatar</p>
          <div className="flex flex-wrap justify-center gap-3">
            {AVATARS.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-label={`Avatar ${item.id}`}
                aria-pressed={avatar === item.id}
                onClick={() => setAvatar(item.id)}
                className={avatar === item.id ? 'rounded-full ring-1 ring-white ring-offset-2 ring-offset-bg' : 'rounded-full'}
              >
                <span className={`block h-9 w-9 rounded-full bg-gradient-to-br ${item.gradient}`} aria-hidden="true" />
              </button>
            ))}
          </div>
        </div>
        <button
          type="button"
          disabled={!canContinue}
          onClick={() => onNext(trimmed, avatar)}
          className="button-primary mt-1 w-full max-w-sm py-3 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Continue
        </button>
      </div>
    </OnboardingShell>
  );
}

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
    <div className="flex min-h-[100dvh] bg-bg px-5 py-6 sm:items-center sm:justify-center">
      <div className="w-full max-w-xl">
        <div className="mb-6 flex items-center justify-between">
          {onBack ? (
            <button type="button" onClick={onBack} className="text-sm font-semibold text-text-secondary hover:text-white">
              ← Back
            </button>
          ) : <span />}
          <div className="flex gap-1.5" aria-label={`Step ${step} of 3`}>
            {[1, 2, 3].map((number) => (
              <span key={number} className={`h-1.5 rounded-full ${number <= step ? 'w-6 bg-accent' : 'w-1.5 bg-white/20'}`} />
            ))}
          </div>
          <span className="w-10" />
        </div>
        <div className="px-1 py-6 sm:py-9">
          <div className="mb-8 text-center">
            <h1 className="text-h2 font-extrabold tracking-tight">{title}</h1>
            {subtitle && <p className="mx-auto mt-2 max-w-md text-sm text-text-secondary">{subtitle}</p>}
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
