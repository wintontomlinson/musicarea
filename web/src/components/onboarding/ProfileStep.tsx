'use client';

import { useState } from 'react';
import { AVATARS } from '@/lib/config';
import { Avatar } from '@/components/ui/Avatar';
import { Icon } from '@/components/ui/Icon';

/**
 * Final setup step: a local display name and an avatar tint. No account, no
 * upload, nothing leaves the device.
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
      step={3}
      title="Add a profile"
      subtitle="Used to label this browser. It is stored locally and never sent anywhere."
      onBack={onBack}
    >
      <div className="flex flex-col items-center gap-7">
        <Avatar name={trimmed || 'M'} avatarId={avatar} size={80} />

        <div className="w-full max-w-sm">
          <label htmlFor="profile-name" className="mb-2 block text-meta text-text-secondary">
            Display name
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
            className="field px-4 py-3 text-center text-[15px] font-medium"
          />
        </div>

        <fieldset className="w-full max-w-sm">
          <legend className="mb-3 w-full text-center text-meta text-text-secondary">
            Avatar colour
          </legend>
          <div className="flex flex-wrap justify-center gap-2.5">
            {AVATARS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                aria-label={preset.label}
                aria-pressed={avatar === preset.id}
                onClick={() => setAvatar(preset.id)}
                style={{ backgroundColor: preset.tint }}
                className={`grid h-11 w-11 place-items-center rounded-full border transition-transform duration-fast ${
                  avatar === preset.id
                    ? 'border-text ring-2 ring-text ring-offset-2 ring-offset-bg'
                    : 'border-white/10 hover:scale-105'
                }`}
              >
                {avatar === preset.id && <Icon name="check" size={17} />}
              </button>
            ))}
          </div>
        </fieldset>

        <button
          type="button"
          disabled={!canContinue}
          onClick={() => onNext(trimmed, avatar)}
          className="btn-primary w-full max-w-sm py-3"
        >
          Start listening
          <Icon name="play" size={15} />
        </button>
      </div>
    </OnboardingShell>
  );
}

/** Shared frame for the setup steps: progress, title, back. */
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
    <div className="flex min-h-[100dvh] justify-center bg-bg px-5 py-10 sm:items-center">
      <div className="w-full max-w-xl">
        <div className="mb-9 flex items-center justify-between">
          {onBack ? (
            <button type="button" onClick={onBack} className="btn-ghost text-meta">
              <Icon name="chevronLeft" size={15} />
              Back
            </button>
          ) : (
            <span className="h-9 w-16" />
          )}

          <div
            className="flex items-center gap-1.5"
            role="progressbar"
            aria-valuemin={1}
            aria-valuemax={3}
            aria-valuenow={step}
            aria-label={`Step ${step} of 3`}
          >
            {[1, 2, 3].map((index) => (
              <span
                key={index}
                className={`h-1 rounded-full transition-all duration-base ${
                  index === step ? 'w-7 bg-accent' : index < step ? 'w-4 bg-text/60' : 'w-4 bg-white/15'
                }`}
              />
            ))}
          </div>

          <span className="h-9 w-16" />
        </div>

        <div className="mb-8 text-center">
          <p className="t-micro">Step {step} of 3</p>
          <h1 className="mt-2.5 text-title font-bold tracking-[-0.024em]">{title}</h1>
          {subtitle && (
            <p className="mx-auto mt-3 max-w-md text-body leading-relaxed text-text-secondary">
              {subtitle}
            </p>
          )}
        </div>

        {children}
      </div>
    </div>
  );
}
