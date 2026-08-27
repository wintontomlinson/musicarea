'use client';

import { useEffect, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { useUser } from '@/stores/user';
import { AVATARS } from '@/lib/config';
import { greeting } from '@/lib/utils';
import { Avatar } from '@/components/ui/Avatar';

/**
 * "Good evening, Priya" with the listener's avatar.
 *
 * The greeting is computed on the client, not the server. It depends on the hour, and
 * the server's clock is not the listener's: a Vercel region in UTC would tell someone
 * in Mumbai "good afternoon" at half past nine at night. Rendering a neutral greeting
 * first and correcting it after mount is the only way to be right about this without
 * asking for a timezone.
 *
 * The name comes from localStorage, so it has the same constraint. Both settle in a
 * single effect, and the fallback wording is chosen to read naturally rather than as
 * a placeholder being swapped out.
 */
/** The clock never notifies us, so there is nothing to subscribe to. */
const noSubscribe = () => () => {};
/** Server snapshot. Null means "the hour is not known here", which it genuinely is not. */
const noGreeting = () => null;

export function GreetingHeader() {
  const hydrate = useUser((state) => state.hydrate);
  const profile = useUser((state) => state.profile);

  /**
   * `useSyncExternalStore` rather than an effect that sets state.
   *
   * This is exactly the case the hook exists for: a value that legitimately differs
   * between server and client. It takes a separate server snapshot, so React expects the
   * difference instead of treating it as a hydration error, and it avoids the cascading
   * render that setting state in an effect would cause.
   *
   * `greeting()` returns a string, so successive snapshots compare equal by value and
   * there is no re-render loop. It changes once when the hour rolls over, which React
   * handles as an ordinary snapshot change.
   */
  const localGreeting = useSyncExternalStore(noSubscribe, greeting, noGreeting);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const name = profile?.name?.trim();

  return (
    <section className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="section-kicker">
          {/* Before the clock is known this says something true rather than guessing at
              the time of day. */}
          {localGreeting ? 'Welcome back' : 'MusicArea'}
        </p>
        <h1 className="mt-1.5 font-display text-h2 font-extrabold tracking-[-0.045em] sm:text-h1">
          {localGreeting ?? 'Your music'}
          {name && (
            <>
              ,{' '}
              <span className="headline-gradient">{name}</span>
            </>
          )}
        </h1>
        <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-text-secondary">
          Picked from what you have been playing, in the languages you follow.
        </p>
      </div>

      {/* Hidden on mobile, where the tab bar already carries a profile entry and this
          would be a second target for the same destination. */}
      <Link
        href="/profile"
        aria-label="Your listening"
        className="hidden shrink-0 rounded-full transition hover:scale-105 sm:block"
      >
        <Avatar
          name={name || 'Listener'}
          avatarId={profile?.avatar ?? AVATARS[0].id}
          size={52}
          className="shadow-glow ring-2 ring-accent/35"
        />
      </Link>
    </section>
  );
}
