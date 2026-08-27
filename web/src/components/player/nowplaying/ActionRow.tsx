'use client';

import { useState } from 'react';
import type { Song } from '@/lib/types';
import { Icon, type IconName } from '@/components/ui/Icon';
import { LikeButton } from '@/components/library/LikeButton';
import { AddToPlaylistButton } from '@/components/library/AddToPlaylistButton';
import { QualityBadge } from '@/components/player/QualityBadge';

/**
 * Secondary controls under the transport: favourite, share, video, quality.
 *
 * The video toggle deserves an explanation, because it is the one control here that cannot do
 * what it says. The brief asked for a YouTube-Music-style audio/video switch, but this app's
 * catalogue is audio-only: there is no video stream for any track, from any source currently
 * wired up. Rather than remove the affordance or wire a button to nothing, it is rendered
 * disabled and says why when pressed. That keeps the design intact and honest, and when a video
 * source is added the only change needed is here.
 */
export function ActionRow({ song }: { song: Song }) {
  const [notice, setNotice] = useState<string | null>(null);

  async function share() {
    const url = `${window.location.origin}/song/${song.id}`;
    const payload = {
      // "Song by Artist" rather than a dash-joined string, which reads badly when a share
      // sheet truncates it.
      title: `${song.name} by ${song.artists?.primary?.[0]?.name ?? 'MusicArea'}`,
      text: `Listening to ${song.name} on MusicArea`,
      url,
    };
    try {
      // The Web Share API opens the native sheet on mobile, which is the only way to reach
      // Instagram or WhatsApp directly. Desktop browsers mostly lack it, so the clipboard is
      // the fallback rather than a second-class share dialog.
      if (navigator.share) {
        await navigator.share(payload);
        return;
      }
      await navigator.clipboard.writeText(url);
      flash('Link copied');
    } catch {
      // An abort is the listener dismissing the share sheet, which is not a failure and must
      // not show an error.
    }
  }

  function flash(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(null), 2000);
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex w-full items-center justify-between gap-1">
        <LikeButton
          song={song}
          size={22}
          className="h-11 w-11 shrink-0 rounded-full transition hover:bg-white/10"
        />

        <AddToPlaylistButton song={song} size={21} className="h-11 w-11 shrink-0" />

        <Action label="Share" icon="share" onClick={share} />

        <Action
          label="Video unavailable for this track"
          icon="videoOff"
          disabled
          onClick={() => flash('This catalogue is audio only')}
        />

        {/* No queue button here on purpose. The queue is one of the tabs a few pixels below, and
            opening the separate overlay panel from inside the player would stack a second modal
            on top of the one that launched it. */}

        <QualityBadge className="shrink-0" />
      </div>

      {/* A local, transient line rather than the global playback alert. These messages are
          confirmations tied to a control the listener just pressed, not playback errors. */}
      <p
        role="status"
        aria-live="polite"
        className={`text-[11.5px] font-semibold transition-opacity duration-200 ${
          notice ? 'text-white/70 opacity-100' : 'opacity-0'
        }`}
      >
        {notice ?? '\u00a0'}
      </p>
    </div>
  );
}

function Action({
  label,
  icon,
  onClick,
  disabled = false,
}: {
  label: string;
  icon: IconName;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      // Not the `disabled` attribute. A disabled button cannot be focused or clicked, so it
      // could neither be discovered by a keyboard nor explain itself when pressed. It is styled
      // as unavailable and marked `aria-disabled`, which conveys the state while staying
      // reachable.
      aria-disabled={disabled || undefined}
      onClick={onClick}
      className={`grid h-11 w-11 shrink-0 place-items-center rounded-full transition ${
        disabled
          ? 'text-white/25 hover:bg-white/[0.06]'
          : 'text-white/75 hover:bg-white/10 hover:text-white'
      }`}
    >
      <Icon name={icon} size={20} />
    </button>
  );
}
