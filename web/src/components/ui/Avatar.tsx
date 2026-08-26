import { AVATARS } from '@/lib/config';

/**
 * Neutral avatar showing the profile's initial. Uses one of the preset grey
 * tints by id; falls back to the first preset (which also covers profiles
 * saved under an older preset id). Reused in onboarding, the sidebar and the
 * top bar.
 */
export function Avatar({
  name,
  avatarId,
  size = 40,
  className = '',
}: {
  name: string;
  avatarId: string;
  size?: number;
  className?: string;
}) {
  const preset = AVATARS.find((a) => a.id === avatarId) ?? AVATARS[0];
  const initial = (name.trim()[0] || 'M').toUpperCase();
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-full font-bold text-white ${className}`}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.42,
        backgroundColor: preset.tint,
      }}
      aria-hidden="true"
    >
      {initial}
    </span>
  );
}
