'use client';

import { useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { m } from 'motion/react';
import { AVATARS, LANGUAGES } from '@/lib/config';
import { useUser } from '@/stores/user';
import { useLibrary } from '@/stores/library';
import { usePlayer } from '@/stores/player';
import { topArtists, topLanguages, uniqueArtistCount } from '@/lib/stats';
import { entityHref, formatCount, pickImage } from '@/lib/utils';
import { Avatar } from '@/components/ui/Avatar';
import { Icon } from '@/components/ui/Icon';
import { staggerContainer, staggerItem } from '@/lib/motion';

/**
 * The listener's own page: who they are on this device, and what they have been
 * playing.
 *
 * This is the redesign's answer to a Wrapped-style summary, with one difference that
 * runs through every line of copy: there is no account and no server, so everything
 * shown is derived from this browser's local history. The page says that plainly
 * rather than implying a year-long record it does not have.
 */
export function ProfileExperience() {
  const hydrateUser = useUser((state) => state.hydrate);
  const hydrateLibrary = useLibrary((state) => state.hydrate);
  const userHydrated = useUser((state) => state.hydrated);
  const libraryHydrated = useLibrary((state) => state.hydrated);
  const profile = useUser((state) => state.profile);
  const languages = useUser((state) => state.languages);
  const liked = useLibrary((state) => state.liked);
  const recent = useLibrary((state) => state.recent);
  const playQueue = usePlayer((state) => state.playQueue);

  useEffect(() => {
    hydrateUser();
    hydrateLibrary();
  }, [hydrateUser, hydrateLibrary]);

  const ready = userHydrated && libraryHydrated;
  const name = profile?.name || 'Listener';

  // Both lists feed the taste summary. History says what you actually play and
  // favourites say what you meant to keep, and neither alone is a fair picture:
  // history over-weights whatever is on repeat this week, favourites over-weight a
  // burst of liking from months ago.
  const pool = [...recent, ...liked];
  const artists = topArtists(pool, 6);
  const langs = topLanguages(pool, 5);

  return (
    <div className="app-page">
      <section className="disco-panel p-6 sm:p-8">
        <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
          <Avatar
            name={name}
            avatarId={profile?.avatar ?? AVATARS[0].id}
            size={92}
            className="shrink-0 shadow-glow ring-4 ring-accent/25"
          />
          <div className="min-w-0">
            <p className="section-kicker">Your listening</p>
            <h1 className="mt-1 text-h2 font-extrabold tracking-[-0.04em] sm:text-h1">{name}</h1>
            <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-white/70">
              Everything on this page is worked out from what you have played in this
              browser. Nothing is uploaded, and there is no account behind it.
            </p>
          </div>
          <Link
            href="/settings"
            className="button-secondary shrink-0 sm:ml-auto"
          >
            <Icon name="gear" size={16} />
            Settings
          </Link>
        </div>
      </section>

      {!ready ? (
        <p className="text-[14px] text-text-secondary">Reading your history on this device…</p>
      ) : (
        <>
          <section aria-label="Summary" className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatCard
              icon="heart"
              value={formatCount(liked.length)}
              label="Liked songs"
              detail={liked.length ? 'Saved on this device' : 'Tap a heart to start'}
            />
            <StatCard
              icon="clock"
              value={formatCount(recent.length)}
              label="Recently played"
              // The cap is surfaced rather than hidden. A figure that silently stops
              // climbing at 60 looks broken; a figure labelled "last 60" does not.
              detail={recent.length >= 60 ? 'Most recent 60 kept' : 'Tracks in your history'}
            />
            <StatCard
              icon="user"
              value={formatCount(uniqueArtistCount(pool))}
              label="Artists"
              detail="In your rotation"
            />
          </section>

          {artists.length > 0 && (
            <section aria-labelledby="top-artists">
              <div className="mb-4 flex items-end justify-between gap-3">
                <div>
                  <p className="section-kicker">On heavy rotation</p>
                  <h2 id="top-artists" className="section-title mt-1">
                    Your top artists
                  </h2>
                </div>
              </div>
              <m.ul
                variants={staggerContainer}
                initial="hidden"
                animate="show"
                className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6"
              >
                {artists.map((artist, index) => (
                  <m.li key={artist.key} variants={staggerItem}>
                    {/* Linked only when the catalogue gave us an artist id. Guessing
                        a URL from the name would produce a dead link, so the tile
                        stays static in that case rather than lying about being
                        clickable. */}
                    {artist.id ? (
                      <Link
                        href={entityHref('artist', artist.label, artist.id)}
                        className="group block text-center"
                      >
                        <ArtistTile artist={artist} index={index} />
                      </Link>
                    ) : (
                      <div className="text-center">
                        <ArtistTile artist={artist} index={index} />
                      </div>
                    )}
                  </m.li>
                ))}
              </m.ul>
            </section>
          )}

          {langs.length > 0 && (
            <section aria-labelledby="top-languages">
              <p className="section-kicker">What you listen in</p>
              <h2 id="top-languages" className="section-title mt-1 mb-4">
                Your languages
              </h2>
              <div className="flex flex-wrap gap-2">
                {langs.map((language) => (
                  <span key={language.key} className="chip cursor-default">
                    {language.label}
                    <span className="text-text-muted">{language.count}</span>
                  </span>
                ))}
              </div>
              <p className="mt-3 text-[12px] text-text-muted">
                Your catalogue preferences are set separately in Settings, currently{' '}
                {languages
                  .map((id) => LANGUAGES.find((entry) => entry.id === id)?.label ?? id)
                  .join(', ') || 'none'}
                .
              </p>
            </section>
          )}

          {recent.length > 0 && (
            <section aria-labelledby="pick-up">
              <div className="mb-4 flex items-end justify-between gap-3">
                <div>
                  <p className="section-kicker">Straight back in</p>
                  <h2 id="pick-up" className="section-title mt-1">
                    Pick up where you left off
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => playQueue(recent, 0)}
                  className="button-primary shrink-0"
                >
                  <Icon name="play" size={15} />
                  Play history
                </button>
              </div>
              <p className="text-[13px] text-text-secondary">
                {recent.length} track{recent.length === 1 ? '' : 's'} in your history on this
                device.{' '}
                <Link href="/recent" className="font-bold text-accent-soft hover:text-white">
                  See all
                </Link>
              </p>
            </section>
          )}

          {recent.length === 0 && liked.length === 0 && (
            <section className="premium-panel p-6 text-center">
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-accent/15 text-accent-soft">
                <Icon name="sparkle" size={22} />
              </span>
              <h2 className="mt-3 text-h4 font-bold">Nothing to summarise yet</h2>
              <p className="mx-auto mt-2 max-w-md text-[14px] leading-relaxed text-text-secondary">
                Play a few tracks and this page will fill in with your top artists and
                the languages you listen in.
              </p>
              <Link href="/" className="button-primary mt-5">
                <Icon name="play" size={15} />
                Find something to play
              </Link>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function ArtistTile({
  artist,
  index,
}: {
  artist: ReturnType<typeof topArtists>[number];
  index: number;
}) {
  return (
    <>
      <span className="relative mx-auto block aspect-square w-full max-w-[132px] overflow-hidden rounded-full border border-white/10 shadow-lift">
        <Image
          src={pickImage(artist.sample.image)}
          alt=""
          fill
          sizes="132px"
          className="object-cover transition duration-500 group-hover:scale-105"
        />
        {/* Rank badge. Reads as a chart position, which is what makes the row feel
            like a summary rather than just a grid of artists. */}
        <span className="absolute bottom-1 left-1/2 -translate-x-1/2 rounded-pill bg-scrim/85 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-glass">
          #{index + 1}
        </span>
      </span>
      <span className="mt-2 block truncate text-[13px] font-bold">{artist.label}</span>
      <span className="block text-[11px] text-text-muted">
        {artist.count} track{artist.count === 1 ? '' : 's'}
      </span>
    </>
  );
}

function StatCard({
  icon,
  value,
  label,
  detail,
}: {
  icon: 'heart' | 'clock' | 'user';
  value: string;
  label: string;
  detail: string;
}) {
  return (
    <div className="surface-card p-4">
      <span className="grid h-9 w-9 place-items-center rounded-full bg-accent/15 text-accent-soft">
        <Icon name={icon} size={17} />
      </span>
      <p className="mt-3 text-h3 font-extrabold tracking-tight">{value}</p>
      <p className="text-[13px] font-bold">{label}</p>
      <p className="mt-0.5 text-[11px] text-text-muted">{detail}</p>
    </div>
  );
}
