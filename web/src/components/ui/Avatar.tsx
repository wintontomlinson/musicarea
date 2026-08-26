import { AVATARS } from '@/lib/config';

/**
 * Profile initial on a preset tint. Falls back to the first preset, which also
 * covers profiles saved under an avatar id from an earlier release.
 */
export function Avatar({
  name,
  avatarId,
  size = 32,
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
      className={`grid shrink-0 place-items-center rounded-full border border-white/10 font-semibold text-text ${className}`}
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.4),
        backgroundColor: preset.tint,
      }}
      aria-hidden="true"
    >
      {initial}
    </span>
  );
}
