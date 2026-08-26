'use client';

import type { Recommendation, SignalName } from '@/lib/types';

/** Readable names for the recommender's eight signals. */
const SIGNAL_LABELS: Record<SignalName, string> = {
  artist: 'Artist affinity',
  collab: 'Played alongside',
  session: 'Recent listening',
  language: 'Language fit',
  era: 'Era fit',
  popularity: 'Mainstream fit',
  freshness: 'How new it is',
  recall: 'Source confidence',
};

/**
 * The breakdown behind a recommendation.
 *
 * Every recommended track carries the reason it surfaced and the normalised
 * signals that produced its score, which is the point of this recommender: it can
 * account for itself. Nothing in the interface read that until now.
 *
 * Not every track has one. The heavy-rotation shelf is a record of what was
 * actually played rather than a prediction, and a cold-start mood set returns
 * only a rank, so the block is treated as partial throughout.
 */
export function WhyThis({ recommendation }: { recommendation?: Recommendation }) {
  if (!recommendation) return null;

  const signals = Object.entries(recommendation.signals ?? {})
    .filter(([, value]) => typeof value === 'number' && value > 0)
    .sort((a, b) => (b[1] as number) - (a[1] as number))
    .slice(0, 5) as Array<[SignalName, number]>;

  const reason = recommendation.reason?.trim();
  if (!reason && !signals.length) return null;

  return (
    <section className="rounded-card border border-white/12 bg-white/[0.04] p-4">
      <p className="section-kicker mb-2">Why this</p>
      {reason && <p className="text-[14px] font-semibold text-white">{reason}</p>}

      {signals.length > 0 && (
        <dl className="mt-3 flex flex-col gap-2">
          {signals.map(([name, value]) => (
            <div key={name} className="flex items-center gap-3">
              <dt className="w-32 shrink-0 text-[12px] text-white/60">
                {SIGNAL_LABELS[name] ?? name}
              </dt>
              <dd className="flex min-w-0 flex-1 items-center gap-2">
                <span className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
                  <span
                    className="block h-full rounded-full bg-accent-soft"
                    style={{ width: `${Math.round(Math.min(1, value) * 100)}%` }}
                  />
                </span>
                <span className="w-8 shrink-0 text-right text-[11px] tabular-nums text-white/45">
                  {Math.round(Math.min(1, value) * 100)}
                </span>
              </dd>
            </div>
          ))}
        </dl>
      )}

      {recommendation.discovery && (
        <p className="mt-3 text-[12px] text-cyan-100/80">
          An artist you have not played before.
        </p>
      )}
    </section>
  );
}
