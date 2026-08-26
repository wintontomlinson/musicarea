'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AVATARS, LANGUAGES, SITE } from '@/lib/config';
import { useUser } from '@/stores/user';
import { usePlayer } from '@/stores/player';
import { useLibrary } from '@/stores/library';
import { Avatar } from '@/components/ui/Avatar';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Modal } from '@/components/ui/Modal';
import { notify } from '@/stores/toast';

/**
 * Settings.
 *
 * A conventional settings page: labelled sections, one control per row, plain
 * language. Anything the product does not actually do is marked as not available
 * rather than shown as an inert switch.
 */
export function SettingsExperience() {
  const router = useRouter();

  const profile = useUser((s) => s.profile);
  const languages = useUser((s) => s.languages);
  const setProfile = useUser((s) => s.setProfile);
  const setLanguages = useUser((s) => s.setLanguages);
  const resetUser = useUser((s) => s.reset);

  const volume = usePlayer((s) => s.volume);
  const muted = usePlayer((s) => s.muted);
  const shuffle = usePlayer((s) => s.shuffle);
  const repeat = usePlayer((s) => s.repeat);
  const autoplay = usePlayer((s) => s.autoplay);
  const setVolume = usePlayer((s) => s.setVolume);
  const toggleMute = usePlayer((s) => s.toggleMute);
  const toggleShuffle = usePlayer((s) => s.toggleShuffle);
  const cycleRepeat = usePlayer((s) => s.cycleRepeat);
  const toggleAutoplay = usePlayer((s) => s.toggleAutoplay);

  const libraryHydrated = useLibrary((s) => s.hydrated);
  const likedCount = useLibrary((s) => s.songs.length);
  const playlistCount = useLibrary((s) => s.playlists.length);
  const historyCount = useLibrary((s) => s.history.length);
  const resetLibrary = useLibrary((s) => s.reset);

  const [name, setName] = useState(profile?.name ?? 'Listener');
  const [avatar, setAvatar] = useState(profile?.avatar ?? AVATARS[0].id);
  const [saved, setSaved] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const cleanName = name.trim().slice(0, 30);

  function saveProfile() {
    if (!cleanName) return;
    setProfile({ name: cleanName, avatar });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  }

  function toggleLanguage(id: string) {
    const active = languages.includes(id);
    // At least one language must stay selected, or the catalogue has nothing to
    // scope its shelves to.
    if (active && languages.length === 1) {
      notify('Keep at least one language selected');
      return;
    }
    setLanguages(active ? languages.filter((entry) => entry !== id) : [...languages, id]);
    router.refresh();
  }

  return (
    <div className="page page-stack max-w-3xl">
      <header>
        <h1 className="t-display">Settings</h1>
        <p className="mt-2.5 text-body leading-relaxed text-text-secondary">
          Everything here applies to this browser. {SITE.name} has no accounts.
        </p>
      </header>

      {/* Profile ------------------------------------------------------------ */}
      <Section title="Profile" description="A local display name, used in the sidebar.">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <Avatar name={cleanName || 'Listener'} avatarId={avatar} size={64} />
          <div className="min-w-0 flex-1">
            <label htmlFor="settings-name" className="mb-2 block text-meta text-text-secondary">
              Display name
            </label>
            <input
              id="settings-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={30}
              className="field px-3.5 py-2.5"
            />
          </div>
        </div>

        <fieldset className="mt-6">
          <legend className="mb-3 text-meta text-text-secondary">Avatar colour</legend>
          <div className="flex flex-wrap gap-2.5">
            {AVATARS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                aria-label={preset.label}
                aria-pressed={avatar === preset.id}
                onClick={() => setAvatar(preset.id)}
                style={{ backgroundColor: preset.tint }}
                className={`grid h-10 w-10 place-items-center rounded-full border transition-transform duration-fast ${
                  avatar === preset.id
                    ? 'border-text ring-2 ring-text ring-offset-2 ring-offset-bg'
                    : 'border-white/10 hover:scale-105'
                }`}
              >
                {avatar === preset.id && <Icon name="check" size={16} />}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="mt-6 flex items-center gap-3">
          <button type="button" onClick={saveProfile} disabled={!cleanName} className="btn-primary">
            Save profile
          </button>
          {saved && <span className="text-meta text-text-secondary">Saved</span>}
        </div>
      </Section>

      {/* Music preferences -------------------------------------------------- */}
      <Section
        id="music-preferences"
        title="Music preferences"
        description="The languages used to choose what appears on Home and Explore."
      >
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {LANGUAGES.map((language) => {
            const active = languages.includes(language.id);
            return (
              <button
                key={language.id}
                type="button"
                aria-pressed={active}
                onClick={() => toggleLanguage(language.id)}
                className={`relative rounded border p-3 text-left transition-colors duration-fast ${
                  active
                    ? 'border-strong bg-white/10'
                    : 'border-subtle bg-white/[0.03] hover:border-strong'
                }`}
              >
                <span className="block text-body font-semibold">{language.label}</span>
                <span className="mt-0.5 block text-micro text-text-secondary">
                  {language.native}
                </span>
                {active && (
                  <span className="absolute right-2 top-2 text-accent">
                    <Icon name="check" size={15} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <p className="mt-4 text-meta text-text-muted">
          {languages.length} selected. Changes take effect on the next page load.
        </p>
      </Section>

      {/* Playback ---------------------------------------------------------- */}
      <Section title="Playback" description="Applies to this device.">
        <div className="flex items-center justify-between gap-6 py-3">
          <label htmlFor="settings-volume" className="text-body font-medium">
            Volume
          </label>
          <div className="flex min-w-0 flex-1 items-center justify-end gap-3">
            <input
              id="settings-volume"
              type="range"
              min={0}
              max={100}
              value={Math.round((muted ? 0 : volume) * 100)}
              onChange={(event) => setVolume(Number(event.target.value) / 100)}
              className="w-40 max-w-full"
            />
            <span className="w-10 text-right text-meta tabular-nums text-text-secondary">
              {Math.round((muted ? 0 : volume) * 100)}%
            </span>
          </div>
        </div>

        <Toggle
          label="Muted"
          hint="Silence playback without losing the volume level"
          icon={muted ? 'volumeOff' : 'volume'}
          on={muted}
          onChange={toggleMute}
        />
        <Toggle
          label="Autoplay"
          hint="When the queue ends, continue with related tracks from the catalogue"
          icon="radio"
          on={autoplay}
          onChange={toggleAutoplay}
        />
        <Toggle
          label="Shuffle"
          hint="Randomise the order when a collection starts"
          icon="shuffle"
          on={shuffle}
          onChange={toggleShuffle}
        />

        <Row
          label="Repeat"
          hint="Off, repeat the queue, or repeat one track"
          icon={repeat === 'one' ? 'repeatOne' : 'repeat'}
        >
          <button type="button" onClick={cycleRepeat} className="chip capitalize">
            {repeat === 'off' ? 'Off' : repeat === 'all' ? 'Queue' : 'One track'}
          </button>
        </Row>
      </Section>

      {/* Audio quality ------------------------------------------------------ */}
      <Section title="Audio" description="Stream quality is chosen automatically.">
        <Row
          label="Stream quality"
          hint="The highest quality the catalogue publishes for a track, currently up to 320 kbps"
          icon="disc"
        >
          <span className="text-meta text-text-secondary">Automatic</span>
        </Row>
        <Row
          label="Crossfade and equaliser"
          hint="Not implemented. Playback uses the browser audio pipeline as-is"
          icon="chart"
        >
          <span className="chip pointer-events-none opacity-70">Not available</span>
        </Row>
        <Row
          label="Offline downloads"
          hint="Not implemented. Nothing is stored for offline playback"
          icon="library"
        >
          <span className="chip pointer-events-none opacity-70">Not available</span>
        </Row>
      </Section>

      {/* Appearance --------------------------------------------------------- */}
      <Section title="Appearance">
        <Row label="Theme" hint="MusicArea uses a single dark theme" icon="disc">
          <span className="text-meta text-text-secondary">Dark</span>
        </Row>
        <Row
          label="Reduced motion"
          hint="Follows your system setting automatically"
          icon="gear"
        >
          <span className="text-meta text-text-secondary">System</span>
        </Row>
      </Section>

      {/* Notifications ------------------------------------------------------ */}
      <Section title="Notifications">
        <Row
          label="System media controls"
          hint="Track details and controls appear on your lock screen and media keys while playing"
          icon="bell"
        >
          <span className="text-meta text-text-secondary">Enabled</span>
        </Row>
        <Row
          label="Push notifications"
          hint="Not implemented. The app sends nothing to your device"
          icon="bell"
        >
          <span className="chip pointer-events-none opacity-70">Not available</span>
        </Row>
      </Section>

      {/* Storage and privacy ------------------------------------------------ */}
      <Section
        title="Storage and privacy"
        description="What is kept in this browser, and how to remove it."
      >
        <Row label="Liked songs" icon="heart">
          <span className="text-meta tabular-nums text-text-secondary">
            {libraryHydrated ? likedCount : ''}
          </span>
        </Row>
        <Row label="Playlists" icon="playlist">
          <span className="text-meta tabular-nums text-text-secondary">
            {libraryHydrated ? playlistCount : ''}
          </span>
        </Row>
        <Row label="History entries" icon="clock">
          <span className="text-meta tabular-nums text-text-secondary">
            {libraryHydrated ? historyCount : ''}
          </span>
        </Row>

        <p className="mt-5 text-meta leading-relaxed text-text-muted">
          Your profile, languages, library and playback preferences are stored in this browser only.
          No account exists and nothing is sent to a server for personalisation. The listening
          languages are also mirrored into a cookie so pages can be rendered for the right catalogue
          on first load.
        </p>

        <button
          type="button"
          onClick={() => setConfirmReset(true)}
          className="btn-secondary mt-5 border-accent/40 text-accent hover:bg-accent/10"
        >
          <Icon name="trash" size={15} />
          Erase local data
        </button>
      </Section>

      {/* About -------------------------------------------------------------- */}
      <Section title="About">
        <Row label={SITE.name} hint={SITE.description} icon="disc">
          <span className="text-meta text-text-secondary">Web</span>
        </Row>
        <Row
          label="Catalogue"
          hint="Music metadata and streams are provided by the MusicArea API"
          icon="radio"
        >
          <span className="text-meta text-text-secondary">Connected</span>
        </Row>
      </Section>

      <Modal
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="Erase local data?"
        description="This removes your profile, language choices, liked songs, playlists and listening history from this browser. It cannot be undone."
        footer={
          <>
            <button type="button" onClick={() => setConfirmReset(false)} className="btn-secondary">
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                resetLibrary();
                resetUser();
                setConfirmReset(false);
                notify('Local data erased');
                router.push('/');
              }}
              className="btn-primary"
            >
              Erase everything
            </button>
          </>
        }
      />
    </div>
  );
}

function Section({
  id,
  title,
  description,
  children,
}: {
  id?: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20">
      <div className="mb-4">
        <h2 className="text-section">{title}</h2>
        {description && <p className="mt-1.5 text-meta text-text-secondary">{description}</p>}
      </div>
      <div className="surface divide-y divide-white/[0.06] px-4 py-1.5">{children}</div>
    </section>
  );
}

function Row({
  label,
  hint,
  icon,
  children,
}: {
  label: string;
  hint?: string;
  icon?: IconName;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-4 py-3.5">
      {icon && (
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-sm bg-white/5 text-text-secondary">
          <Icon name={icon} size={17} />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-body font-medium">{label}</p>
        {hint && <p className="mt-0.5 text-meta leading-snug text-text-muted">{hint}</p>}
      </div>
      {children && <div className="shrink-0">{children}</div>}
    </div>
  );
}

/** Accessible switch built on a checkbox, so it reports its own state. */
function Toggle({
  label,
  hint,
  icon,
  on,
  onChange,
}: {
  label: string;
  hint?: string;
  icon?: IconName;
  on: boolean;
  onChange: () => void;
}) {
  return (
    <Row label={label} hint={hint} icon={icon}>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={label}
        onClick={onChange}
        className={`relative h-6 w-11 rounded-full transition-colors duration-fast ${
          on ? 'bg-accent' : 'bg-white/15'
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform duration-fast ${
            on ? 'translate-x-[22px]' : 'translate-x-0.5'
          }`}
        />
      </button>
    </Row>
  );
}
