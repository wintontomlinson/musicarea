'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AVATARS, LANGUAGES } from '@/lib/config';
import { useUser } from '@/stores/user';
import { usePlayer } from '@/stores/player';
import { useHistory } from '@/stores/history';
import { resetPersonalised } from '@/lib/personalised';
import { QUALITY_LABELS, STREAM_QUALITIES } from '@/lib/utils';
import { Avatar } from '@/components/ui/Avatar';
import { Icon, type IconName } from '@/components/ui/Icon';

export function SettingsExperience() {
  const router = useRouter();
  const profile = useUser((state) => state.profile);
  const languages = useUser((state) => state.languages);
  const setProfile = useUser((state) => state.setProfile);
  const setLanguages = useUser((state) => state.setLanguages);
  const reset = useUser((state) => state.reset);
  const volume = usePlayer((state) => state.volume);
  const muted = usePlayer((state) => state.muted);
  const shuffle = usePlayer((state) => state.shuffle);
  const repeat = usePlayer((state) => state.repeat);
  const setVolume = usePlayer((state) => state.setVolume);
  const toggleMute = usePlayer((state) => state.toggleMute);
  const toggleShuffle = usePlayer((state) => state.toggleShuffle);
  const cycleRepeat = usePlayer((state) => state.cycleRepeat);
  const autoplay = usePlayer((state) => state.autoplay);
  const toggleAutoplay = usePlayer((state) => state.toggleAutoplay);
  const quality = usePlayer((state) => state.quality);
  const setQuality = usePlayer((state) => state.setQuality);
  const activeQuality = usePlayer((state) => state.activeQuality);
  const activeSteppedDown = usePlayer((state) => state.activeSteppedDown);
  const hydrateHistory = useHistory((state) => state.hydrate);
  const historyCount = useHistory((state) => state.entries.length);
  const clearHistory = useHistory((state) => state.clear);
  const [name, setName] = useState(profile?.name ?? 'Listener');
  const [avatar, setAvatar] = useState(profile?.avatar ?? AVATARS[0].id);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    hydrateHistory();
  }, [hydrateHistory]);

  const cleanName = name.trim().slice(0, 30);
  function saveProfile() { if (!cleanName) return; setProfile({ name: cleanName, avatar }); setSaved(true); window.setTimeout(() => setSaved(false), 1800); }
  function toggleLanguage(id: string) { const active = languages.includes(id); if (active && languages.length === 1) return; setLanguages(active ? languages.filter((language) => language !== id) : [...languages, id]); router.refresh(); }
  function resetLocalProfile() { if (window.confirm('Reset your local profile and language choices on this device?')) reset(); }

  /**
   * Clearing the log resets the recommender to a cold start, because the profile
   * is rebuilt from it on every request. The cached feed and mixes have to go
   * with it, otherwise the old personalised shelves would sit there for another
   * few minutes after the data behind them was deleted.
   */
  function clearListeningHistory() {
    if (!window.confirm('Clear your listening history? Recommendations will start from scratch.')) return;
    clearHistory();
    resetPersonalised();
    router.refresh();
  }

  return <div className="app-page"><section className="disco-panel p-6 sm:p-8"><p className="section-kicker">Personal control room</p><h1 className="mt-2 text-h2 font-extrabold tracking-[-0.04em] sm:text-h1">Make it <span className="headline-gradient">your own.</span></h1><p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-white/70">Your profile, listening languages and player choices are stored on this device. No account or cloud sync is implied.</p></section>
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,.75fr)]"><div className="flex flex-col gap-6"><section className="premium-panel p-5 sm:p-6"><div className="mb-6 flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-full bg-fuchsia-400/15 text-accent-soft"><Icon name="sparkle" size={18} /></span><div><h2 className="section-title">Profile</h2><p className="mt-0.5 text-[12px] text-text-secondary">A local display name for this device.</p></div></div><div className="flex flex-col gap-6 sm:flex-row sm:items-center"><Avatar name={cleanName || 'Listener'} avatarId={avatar} size={82} className="ring-4 ring-fuchsia-300/25 shadow-glow" /><div className="min-w-0 flex-1"><label htmlFor="settings-name" className="mb-2 block text-[12px] font-bold uppercase tracking-[0.1em] text-text-muted">Display name</label><input id="settings-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={30} className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-[15px] font-semibold outline-none transition placeholder:text-text-muted focus:border-fuchsia-300/60" /></div></div><div className="mt-6"><p className="mb-3 text-[12px] font-bold uppercase tracking-[0.1em] text-text-muted">Avatar colour</p><div className="flex flex-wrap gap-3">{AVATARS.map((item) => <button key={item.id} type="button" aria-label={`${item.id} avatar`} aria-pressed={avatar === item.id} onClick={() => setAvatar(item.id)} className={`grid h-10 w-10 place-items-center rounded-full transition hover:scale-105 ${avatar === item.id ? 'ring-2 ring-cyan-200 ring-offset-2 ring-offset-surface' : ''}`} style={{ backgroundColor: item.tint }}>{avatar === item.id && <Icon name="check" size={17} />}</button>)}</div></div><div className="mt-6 flex items-center gap-3"><button type="button" disabled={!cleanName} onClick={saveProfile} className="button-primary disabled:cursor-not-allowed disabled:opacity-40"><Icon name="check" size={16} />Save profile</button>{saved && <span className="text-[13px] font-semibold text-cyan-200">Saved on this device</span>}</div></section>
      <section className="premium-panel p-5 sm:p-6"><div className="mb-5"><p className="section-kicker mb-1">Tune your catalogue</p><h2 className="section-title">Languages</h2><p className="mt-1 text-[12px] text-text-secondary">These choices refresh Home and Explore with matching catalogue shelves.</p></div><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{LANGUAGES.map((language) => { const active = languages.includes(language.id); return <button key={language.id} type="button" aria-pressed={active} onClick={() => toggleLanguage(language.id)} style={{ backgroundColor: active ? language.tint : undefined }} className={`relative min-h-[82px] rounded-card border p-3 text-left transition ${active ? 'border-cyan-200/70 shadow-cyan' : 'border-white/10 bg-white/[0.04] hover:border-white/25'}`}><span className="block text-[14px] font-bold">{language.label}</span><span className="mt-1 block text-[11px] text-white/65">{language.native}</span>{active && <span className="absolute right-2 top-2 grid h-5 w-5 place-items-center rounded-full bg-cyan-200 text-violet-950"><Icon name="check" size={13} /></span>}</button>; })}</div><p className="mt-4 text-[12px] text-text-muted">Keep at least one language selected.</p></section></div>
      <aside className="flex flex-col gap-6"><section className="premium-panel p-5"><p className="section-kicker mb-1">Playback</p><h2 className="section-title">Player preferences</h2><div className="mt-5 space-y-5"><div><div className="mb-2 flex items-center justify-between text-[13px]"><span className="font-semibold">Volume</span><span className="text-text-secondary">{Math.round(volume * 100)}%</span></div><input aria-label="Volume" type="range" min="0" max="1" step="0.01" value={volume} onChange={(event) => setVolume(Number(event.target.value))} className="h-1.5 w-full cursor-pointer accent-fuchsia-400" /></div><PreferenceButton label={muted ? 'Muted' : 'Sound on'} detail="Controls this device" icon={muted ? 'volumeOff' : 'volume'} active={!muted} onClick={toggleMute} /><PreferenceButton label={shuffle ? 'Shuffle is on' : 'Shuffle is off'} detail="Used when you start a queue" icon="shuffle" active={shuffle} onClick={toggleShuffle} /><PreferenceButton label={`Repeat: ${repeat}`} detail="Cycles off, all and one" icon="repeat" active={repeat !== 'off'} onClick={cycleRepeat} /><PreferenceButton label={autoplay ? 'Autoplay is on' : 'Autoplay is off'} detail="Keeps playing similar music when the queue ends" icon="disc" active={autoplay} onClick={toggleAutoplay} /></div></section>
        <section className="premium-panel p-5"><p className="section-kicker mb-1">Streaming</p><h2 className="section-title">Audio quality</h2><div className="mt-4 space-y-2">{STREAM_QUALITIES.map((rung) => { const active = quality === rung; const info = QUALITY_LABELS[rung]; return <button key={rung} type="button" aria-pressed={active} onClick={() => setQuality(rung)} className={`flex w-full items-center gap-3 rounded-card border p-3 text-left transition ${active ? 'border-fuchsia-300/35 bg-fuchsia-500/10' : 'border-white/10 bg-black/15 hover:bg-white/[0.06]'}`}><span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-[11px] font-bold tabular-nums ${active ? 'bg-brand text-white' : 'bg-white/[0.08] text-text-secondary'}`}>{rung.replace('kbps', '')}</span><span className="min-w-0"><span className="block text-[13px] font-bold">{info.label}</span><span className="mt-0.5 block text-[11px] leading-relaxed text-text-secondary">{info.detail}</span></span>{active && <Icon name="check" size={16} className="ml-auto shrink-0 text-accent-soft" />}</button>; })}</div>
          <p className="mt-4 text-[12px] leading-relaxed text-text-secondary">{activeQuality ? <>Currently playing at <span className="font-bold text-white">{activeQuality}</span>{activeSteppedDown && <> because this track does not offer {quality}</>}.</> : 'Start a track to see the rung in use.'}</p>
          <p className="mt-2 text-[12px] leading-relaxed text-text-muted">There is no lossless tier to offer. The catalogue publishes five rungs, all AAC in an MP4 container, so 320 kbps is a real ceiling rather than a setting. If a track is missing your choice, it steps down for that track only rather than failing.</p></section>
        <section className="premium-panel p-5"><p className="section-kicker mb-1">Recommendations</p><h2 className="section-title">Listening history</h2><p className="mt-2 text-[12px] leading-relaxed text-text-secondary">Your plays, likes and skips are kept on this device and sent with each request so the recommender can rank for you. It keeps no account and stores nothing server side, so this log is the whole profile.</p><p className="mt-3 text-[13px] font-semibold">{historyCount ? `${historyCount} ${historyCount === 1 ? 'event' : 'events'} recorded` : 'No listening recorded yet'}</p>{historyCount > 0 && <button type="button" onClick={clearListeningHistory} className="mt-3 text-[13px] font-bold text-accent-soft hover:text-white">Clear listening history</button>}</section>
        <section className="rounded-xl2 border border-fuchsia-300/15 bg-fuchsia-500/[0.06] p-5"><h2 className="text-[15px] font-extrabold">Local storage notice</h2><p className="mt-2 text-[12px] leading-relaxed text-text-secondary">Profile and language choices use local browser storage. Player preferences, favourites and listening history are stored separately on this device.</p><button type="button" onClick={resetLocalProfile} className="mt-4 text-[13px] font-bold text-accent-soft hover:text-white">Reset local profile</button></section></aside></div></div>;
}

function PreferenceButton({ label, detail, icon, active, onClick }: { label: string; detail: string; icon: IconName; active: boolean; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`flex w-full items-center gap-3 rounded-card border p-3 text-left transition ${active ? 'border-fuchsia-300/35 bg-fuchsia-500/10' : 'border-white/10 bg-black/15 hover:bg-white/[0.06]'}`}><span className={`grid h-9 w-9 place-items-center rounded-full ${active ? 'bg-brand text-white' : 'bg-white/[0.08] text-text-secondary'}`}><Icon name={icon} size={17} /></span><span><span className="block text-[13px] font-bold">{label}</span><span className="mt-0.5 block text-[11px] text-text-secondary">{detail}</span></span></button>;
}
