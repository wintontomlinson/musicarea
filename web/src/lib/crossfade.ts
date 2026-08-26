/**
 * Gain pair for a crossfade at a given point through it.
 *
 * `progress` runs 0 to 1. The outgoing deck follows `cos`, the incoming one
 * `sin`, which is an equal-power curve rather than a linear one.
 *
 * That choice is audible. Two different recordings are uncorrelated, so they sum
 * by power rather than by amplitude: fading one down and the other up along
 * straight lines leaves the pair measurably quieter through the middle, which is
 * heard as a dip every time a track changes. On this curve the squares of the two
 * gains sum to 1 at every point, so the total power is constant and the crossover
 * sits at 0.707 on both sides.
 */
export function equalPowerGains(progress: number): { outgoing: number; incoming: number } {
  const p = Math.max(0, Math.min(1, progress));
  const angle = (p * Math.PI) / 2;
  return { outgoing: Math.cos(angle), incoming: Math.sin(angle) };
}
