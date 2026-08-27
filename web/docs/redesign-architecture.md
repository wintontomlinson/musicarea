# MusicArea Redesign: Component Architecture Plan

Step 1 deliverable. This plan is written against the actual codebase (Next.js 16.3.3, React 19,
Tailwind 3.4, Zustand 5, Howler) and the actual Flask/JioSaavn backend, not against assumptions.

---

## 0. What already exists (do not rebuild)

The brief lists several things as new work that are already implemented, in some cases more
thoroughly than the brief specifies.

| Brief item | Reality |
| --- | --- |
| "Blurred/gradient background derived from album art color" | `src/lib/color.ts` (558 lines) is a complete palette engine: 48x48 canvas sampling, 24-bucket hue voting, WCAG relative-luminance normalisation, secondary-hue arc clamping, automatic ink flipping. It propagates 12 channels as CSS custom properties on `<html>` and cross-fades them over 600ms using `@property` registration. |
| "Dark theme as default" | Already the only theme. `color-scheme: dark`, dual radial accent washes on `body`. |
| "Full-screen immersive Now Playing" | `player/FullPlayer.tsx` exists with body-scroll lock, Escape handling, and touch swipe-down-to-dismiss (velocity + distance thresholds, `scrollTop === 0` guard). Mobile-shaped only (`max-w-md`). |
| "Queue management accessible inline" | `player/QueuePanel.tsx` exists: slide-in aside, HTML5 drag-and-drop reorder, remove, clear-but-keep-current. |
| "Persistent mini player bar" | Two of them: `MiniPlayer.tsx` (mobile) and `NowPlayingBar.tsx` (desktop, hosted inside `Topbar`). |
| "Framer Motion for page transitions" | Not installed. Genuinely new. |
| Media keys / lock screen | `player/MediaSession.tsx` already bridges to the OS. |
| Keyboard shortcuts | `player/KeyboardShortcuts.tsx` already covers transport, seek, volume, shuffle, repeat. |

The redesign therefore **extends and re-skins** the player layer rather than replacing it, and
**leaves `color.ts` structurally intact** while adding fixed-accent modes to it.

### Player store contract (build against this, do not fork it)

`src/stores/player.ts` models the queue as an indirection array. Getting this wrong is the easiest
bug to introduce:

```ts
queue: Song[]      // natural order
order: number[]    // playback order, values are indices INTO queue
orderPos: number   // position within `order`
// currentSong === queue[order[orderPos]]
```

- `playAt(pos)` takes an **`order` position**.
- `reorderQueue(from, to)` and `removeFromQueue(i)` take **natural `queue` indices**.
- Seeking is a **separate channel from progress**. Never write `currentTime` to move playback; call
  `seekTo()`, which increments a monotonic `seekSeq` that `AudioEngine` watches. Note `seekTo`
  clamps to `0` whenever `duration === 0`.
- `next(auto)`: `auto` means "the track ended". UI buttons must call `next(false)`.

---

## 1. Six reality checks that change the brief

These are the decisions that need your sign-off, because three P0/P1 features cannot be built as
specified.

### 1.1 Synced karaoke lyrics: no timestamps exist upstream (blocks a P0)

The Flask API has `GET /api/songs/<id>/lyrics` (`app.py`), but it returns an **unsynced HTML/text
blob**:

```py
{ "lyrics": body, "copyright": ..., "snippet": ... }
```

There are no per-line timings anywhere in JioSaavn's response. Apple-Music-style one-line karaoke
highlighting is impossible from this source. Three options:

- **(A) Recommended: add LRCLIB as a synced-lyrics source, fall back to the Flask blob.**
  [LRCLIB](https://lrclib.net) is a free, open service for synchronised lyrics in LRC format
  ([source repo](https://github.com/tranxuanthang/lrclib)), queryable by track name, artist name and
  duration, which is exactly the metadata `Song` carries. When LRCLIB has a match we get true
  karaoke; when it does not we degrade to a beautiful scrolling static reading view from Flask.
  Coverage for Bollywood and regional Indian catalogue will be **materially thinner** than for
  Western pop, so the static fallback is the common path, not the edge case. Build both properly.
- **(B) Static-only.** Ship the Flask blob as a centred, large-type reading pane. Honest, cheap, no
  karaoke.
- **(C) Reject: synthesise timings** by dividing duration across line count. This drifts audibly
  within seconds and reads as broken rather than approximate.

Plan assumes **(A)**, with the lyrics layer designed so the source is swappable.

### 1.2 Music video mode: there is no video source (blocks a P1)

JioSaavn serves audio only. Nothing in `types.ts` or the Flask layer references video. A working
video toggle needs a second provider (YouTube search plus embed), which brings its own quota, terms
and player. Options: **scope it out**, or ship the toggle **disabled with a "Video unavailable for
this track" state** so the affordance exists without lying. Plan assumes the latter, gated behind a
feature flag that is off by default.

### 1.3 Waveform / frequency visualizer: FFT is blocked (affects a P2)

Real frequency data needs a Web Audio `AnalyserNode`. Two independent blockers: `AudioEngine` runs
Howler with `html5: true` (deliberately, for mobile and long-track reliability), and the JioSaavn
CDN sends no CORS headers, so the audio graph would be tainted and the analyser would read silence.
Switching to `html5: false` would regress mobile playback.

Decision: build an **ambient visualizer, not a reactive one**. It is driven by the playback clock and
the extracted palette, clearly a mood element rather than a lie about the audio. Named
`AmbientVisualizer` so nobody later assumes it is FFT-backed. The legacy Flask frontend
(`static/js/app.js` `Viz`) does have a real analyser; it also serves audio from a different path.

### 1.4 Social features have no backend (affects most P2 items)

There are no accounts, no server-side user state, and no database. `liked`, `recent` and profile all
live in `localStorage` (`stores/library.ts`, `stores/user.ts`). So:

- **Collaborative playlists with member avatars**: not implementable. There are no other users.
- **Cross-device handoff indicator ("playing on X")**: not implementable. No device registry.
- **Share song card (Instagram story format)**: fully implementable. Client-side canvas render of
  artwork plus palette plus title, exported as a 1080x1920 PNG via the Web Share API. Real feature,
  no backend needed. Recommend promoting this one.
- **Wrapped-style stats**: implementable but only from local history, so it reflects listening on
  that browser since install, not a true year. Label it "Your listening" rather than an annual
  Wrapped, and derive it honestly from `library.recent`.

Recommendation: build ShareCard and local stats for real; **cut** collaborative playlists and device
handoff rather than shipping decorative UI that implies features you do not have. If you want them
as visual placeholders for a demo, say so and I will build them clearly marked as previews.

### 1.5 The AI DJ and smart playlists can be genuinely real (upgrade, not a mockup)

Good news that the brief did not anticipate. The Flask layer already exposes a recommender and
several endpoints the web app **never calls**:

- `GET /api/radio/<song_id>`, `GET /api/artists/<id>/radio`: endless personalised stations.
- `POST /api/mixes`: personalised mixes.
- `POST /api/similar`: more-like-this for a selection.
- `GET /api/songs/<id>/suggestions`: JioSaavn entity-station autoplay.
- `GET /api/trending`, `/api/new-releases`, `/api/featured`, `/api/genres`.

Worse, `src/app/(main)/page.tsx` calls `api.feed({ history: [] })`, so the recommender **always runs
in cold-start** even though `stores/library.ts` holds real liked and recent data. And `Song` already
carries a `Recommendation` object (`score`, `reason`, `signals`, `discovery`, `familiar`) that is
currently never rendered.

So the AI DJ card backs onto `/api/radio`, the Discover-Weekly-equivalent backs onto `/api/mixes`
plus a feed call with **real history**, and cards can display a genuine "because you played X"
reason. Wiring local history into the feed is the single biggest quality win available and it is
mostly plumbing.

Naming: "Discover Weekly", "Release Radar", "AI DJ" and "Wrapped" are Spotify product names. Using
them verbatim in shipped UI is a trademark problem. Proposed equivalents: **Radio** (the DJ),
**Fresh Finds** (weekly discovery), **New For You** (release radar), **Your Listening** (wrapped).

### 1.6 Base colour: #0a0a0a conflicts with the existing palette engine

The brief specifies a neutral OLED base (`#0a0a0a` / `#111` / `#1a1a1a`). The current engine
**generates all neutrals from the extracted accent hue**, so the base is a purple-tinted `#090613`
and shifts per artwork. That tinting is the main reason the app currently feels cohesive.

Resolution: add a `neutralMode` to the palette builder. `tinted` keeps today's behaviour;
`neutral` pins backgrounds to the specified greys and lets only the accent tokens move. Expose it in
Settings alongside the accent toggle, default `tinted`. This gives you the requested values without
throwing away the tuned engine.

Also note existing `borderRadius.card` is 16px, not the specified 12px. Plan adds 12px as `card` and
keeps 16px as `card-lg` so nothing currently styled visually jumps.

---

## 2. Component architecture

`[NEW]` create, `[MOD]` modify in place, `[RET]` retire and delete, `[KEEP]` untouched.

### 2.1 Foundation: theme, tokens, primitives

```
web/tailwind.config.ts                        [MOD]  radius 12/16 split, glass blur, motion easings,
                                                     SF Pro Display in the display font stack
web/src/app/globals.css                       [MOD]  neutral-mode vars, .glass-* utilities, chip/tab
                                                     component classes, reduced-motion additions
web/src/app/layout.tsx                        [MOD]  add display font, MotionProvider
web/src/lib/color.ts                           [MOD]  buildPalette gains { neutralMode, accentSeed };
                                                     new FIXED_ACCENTS = { green #1DB954, red #FC3C44 }
web/src/stores/theme.ts                        [MOD]  + accentMode: 'adaptive'|'green'|'red',
                                                     + neutralMode: 'tinted'|'neutral',
                                                     + palette: Palette (expose as JS state)
web/src/components/theme/DynamicTheme.tsx      [MOD]  honour accentMode/neutralMode, publish palette
web/src/hooks/usePalette.ts                    [NEW]  read palette from store for canvas/SVG consumers
web/src/components/motion/MotionProvider.tsx   [NEW]  LazyMotion + reduced-motion bridge
web/src/lib/motion.ts                          [NEW]  shared variants and spring presets
```

Why a store-published palette: canvas (ShareCard), SVG gradients and the visualizer need the accent
as a **JS value**. Today it exists only as a CSS custom property. `DynamicTheme` already computes it,
so publishing it costs almost nothing and avoids `getComputedStyle` reads in render paths.

#### UI primitives

```
web/src/components/ui/Chip.tsx          [NEW]  999px pill, selected/unselected, used by moods+trending
web/src/components/ui/Tabs.tsx          [NEW]  animated underline via Framer layoutId, a11y tablist
web/src/components/ui/Sheet.tsx         [NEW]  bottom sheet (mobile) / side panel (desktop), extracts
                                               FullPlayer's swipe-dismiss + scroll-lock logic
web/src/components/ui/GlassPanel.tsx    [NEW]  frosted panel, backdrop-blur(20px) + rgba, with an
                                               opaque fallback where backdrop-filter is unsupported
web/src/components/ui/Skeleton.tsx      [NEW]  shimmer placeholders for client-fetched rows
web/src/components/ui/Marquee.tsx       [NEW]  scroll only when text actually overflows
web/src/components/ui/Icon.tsx          [MOD]  add mic, cast, video, lyrics, dj, share, shuffle-variants
web/src/components/ui/Avatar.tsx        [KEEP]
```

`Sheet` matters: the swipe-to-dismiss gesture in `FullPlayer` is good and hard-won. Extracting it
means the Now Playing screen, queue panel and share sheet all inherit it instead of each
reimplementing it.

### 2.2 Layout shell

```
web/src/app/(main)/layout.tsx                  [MOD]  mount PlayerBar; retire MiniPlayer/NowPlayingBar/
                                                     FullPlayer mounts; fix <main> bottom padding for a
                                                     persistent desktop bar (currently only lg:pb-10)
web/src/components/layout/Sidebar.tsx          [MOD]  + playlists list, + mini now-playing card
web/src/components/layout/MobileNav.tsx        [MOD]  Home | Search | Samples | Library | Profile
web/src/components/layout/Topbar.tsx           [MOD]  slim down: hand transport + volume to PlayerBar,
                                                     keep nav/search/avatar
web/src/components/layout/SidebarNowPlaying.tsx [NEW] desktop sidebar art card, opens Now Playing
```

Everything in the player stack lives in the layout, so playback survives route changes. Preserve
that. The z-index map must stay coherent: MobileNav/PlayerBar `z-40`, Topbar `z-30`, Now Playing
`z-50`, Queue scrim `z-[55]` / panel `z-[56]`, PlaybackAlert `z-[60]`.

### 2.3 Player: mini bar

```
web/src/components/player/PlayerBar.tsx        [NEW]  ONE responsive bar replacing both current bars
web/src/components/player/MiniPlayer.tsx       [RET]
web/src/components/player/NowPlayingBar.tsx    [RET]
web/src/components/player/SeekBar.tsx          [MOD]  accent-tinted fill, scrub tooltip, keeps the
                                                     pointer-capture + stopPropagation arrow handling
web/src/components/player/PlayerControls.tsx   [MOD]  restyle, size variants mini|bar|full
web/src/components/player/VolumeControl.tsx    [MOD]  restyle
web/src/components/player/QualityBadge.tsx     [NEW]  derived from the chosen downloadUrl quality
web/src/components/player/PlaybackAlert.tsx    [MOD]  glass styling
web/src/components/player/AudioEngine.tsx      [KEEP] no changes needed
web/src/components/player/MediaSession.tsx     [KEEP]
web/src/components/player/KeyboardShortcuts.tsx [MOD] add q (queue), l (lyrics), f (fullscreen)
```

Collapsing the two bars into one is the biggest structural simplification here. Today mobile and
desktop now-playing UI are separate components with duplicated logic, and the desktop one is
awkwardly nested inside `Topbar`. One `PlayerBar` with responsive internals removes that split and
gives desktop the persistent bar the brief asks for.

`QualityBadge` is honest: it reports the bitrate actually selected by `pickStreamUrl` (320/160/96),
so it reads "320" rather than claiming "Lossless", which this catalogue does not serve.

### 2.4 Player: immersive Now Playing

```
web/src/components/player/nowplaying/NowPlayingScreen.tsx  [NEW]  replaces FullPlayer; responsive:
                                                                  mobile single column, desktop two-pane
web/src/components/player/nowplaying/ArtStage.tsx          [NEW]  animated artwork + ambient backdrop
web/src/components/player/nowplaying/NowPlayingHeader.tsx  [NEW]  collapse, source label, overflow
web/src/components/player/nowplaying/TrackMeta.tsx         [NEW]  large title/artist, Apple-ish type
web/src/components/player/nowplaying/ActionRow.tsx         [NEW]  like, add, share, lyrics, video, quality
web/src/components/player/nowplaying/NowPlayingTabs.tsx    [NEW]  Up next | Lyrics | Related
web/src/components/player/nowplaying/LyricsPane.tsx        [NEW]  P0, synced + static modes
web/src/components/player/nowplaying/LyricLine.tsx         [NEW]  active/adjacent/far states
web/src/components/player/nowplaying/AmbientVisualizer.tsx  [NEW]  P2, clock-driven, not FFT
web/src/components/player/nowplaying/ShareCard.tsx         [NEW]  P2, canvas 1080x1920 export
web/src/components/player/nowplaying/RelatedPane.tsx       [NEW]  uses the unused /api/similar
web/src/components/player/FullPlayer.tsx                   [RET]  logic migrates to Sheet + screen
```

Desktop gets a genuine two-pane immersive view (art left, lyrics or queue right), which is the main
thing missing today. Mobile keeps the single-column sheet.

### 2.5 Player: queue and gestures

```
web/src/components/player/QueuePanel.tsx        [MOD]  restyle, touch reorder, "Play next" affordance,
                                                      and it must render inside NowPlayingScreen on
                                                      desktop rather than only as an overlay
web/src/components/player/SwipeableTrackRow.tsx [NEW]  P1: swipe left = add to queue, right = play next
web/src/hooks/useSwipeGesture.ts                [NEW]  pointer-events based, respects vertical scroll
```

Current queue reorder is HTML5 drag-and-drop, which is **pointer-only and does not work on touch**.
Since the brief is mobile-first, this needs a pointer-events reorder path.

### 2.6 Lyrics subsystem

```
web/src/lib/lyrics.ts             [NEW]  LRC parser -> LyricLine[]; HTML-blob -> plain lines
web/src/lib/api.ts                [MOD]  + lyrics(id), + radio(id), + similar(ids), + mixes(payload),
                                         + suggestions(id), + trending/newReleases/genres
web/src/app/api/lyrics/[id]/route.ts [NEW] client-reachable proxy: LRCLIB first, Flask fallback
web/src/stores/lyrics.ts          [NEW]  per-track cache with TTLs, mirroring the legacy client's
                                         10min hit / 3min miss policy
web/src/hooks/useLyrics.ts        [NEW]  fetch + cache + active-line index
web/src/hooks/usePlaybackClock.ts [NEW]  high-resolution interpolated clock
```

Types:

```ts
export interface LyricLine { time: number | null; text: string }   // time === null => unsynced
export type LyricsState =
  | { kind: 'loading' }
  | { kind: 'synced';   lines: LyricLine[]; copyright?: string }
  | { kind: 'static';   lines: LyricLine[]; copyright?: string }
  | { kind: 'none' }
  | { kind: 'error' }
```

**The clock is the critical detail.** `AudioEngine` reports progress on a 250ms `setInterval`, and
only when the delta exceeds 0.25s. Karaoke highlighting at that granularity visibly steps. Rather
than touch the engine (its ticker is deliberately `setInterval`, not `rAF`, because `rAF` is
suspended when the tab is backgrounded or the phone is locked), `usePlaybackClock` **interpolates**:

```
displayTime = currentTime + (isPlaying ? (performance.now() - lastTickAt) / 1000 : 0)
```

resynced on every store tick and on `seekSeq` change. That yields smooth 60fps highlighting with
zero risk to background playback reliability, and it needs no new audio plumbing.

A client-reachable route handler is mandatory here: `lib/api.ts` is server-only by design
(`FLASK_API_BASE` has no `NEXT_PUBLIC_` prefix and Flask sends no CORS headers), exactly as
`AudioEngine` already goes through `/api/song/[id]` for stream URLs.

### 2.7 Home

```
web/src/app/(main)/page.tsx                       [MOD]  server shell: browse + feed seeded with the
                                                         language cookie, hands off to the client
web/src/components/home/HomeExperience.tsx        [NEW]  client orchestrator; re-fetches the feed with
                                                         REAL history from stores/library
web/src/components/home/GreetingHeader.tsx        [NEW]  greeting() + avatar, already have the helper
web/src/components/home/MoodChips.tsx             [NEW]  P0, horizontal scroll, filters the feed
web/src/components/home/RadioCard.tsx             [NEW]  P1, the "AI DJ", backs onto /api/radio
web/src/components/home/QuickPicks.tsx            [NEW]  P0, horizontal rows of 4 stacked tracks
web/src/components/home/SmartPlaylistCards.tsx    [NEW]  Fresh Finds / New For You, gradient covers
web/src/components/home/RecentGrid.tsx            [NEW]  2 col mobile / 3 desktop, from library.recent
web/src/components/home/SamplesStrip.tsx          [NEW]  P1, entry point to /samples
web/src/components/home/ReasonPill.tsx            [NEW]  renders Song.recommendation.reason
web/src/components/sections/Carousel.tsx          [MOD]  restyle, keep the Row contract
web/src/components/cards/MediaCard.tsx            [MOD]  12px radius, hover/press motion, swipe support
web/src/components/sections/Hero.tsx              [MOD]  restyle or fold into SmartPlaylistCards
web/src/components/sections/MoodGrid.tsx          [MOD]  keep for /explore and /search, restyle
```

Home becomes a **server shell plus client experience** (the pattern `search` already uses). It must,
because mood filtering and history-personalised feed both need client state. The server render still
produces real content for SEO and first paint.

**Mood chips need a backend tweak.** The brief lists Energetic / Chill / Focus / Workout / Party /
Sleep. Actual moods are hardcoded in `catalog.py` `MOODS`: romance, party, chill, sad, workout,
devotion, retro, indie, sufi, focus. Four of six already exist. Rather than invent chips that 404, I
propose adding `sleep` and `energetic` to the Python `MOODS` list (a few lines, each needs
`{id, name, query, keyword, hue, image}`) and surfacing the real ten. `Mood.hue` is already carried
per mood and is currently unused, which is a natural way to tint each chip.

### 2.8 Samples (Shorts-style)

```
web/src/app/(main)/samples/page.tsx              [NEW]  full-bleed, hides the player bar
web/src/components/samples/SamplesFeed.tsx       [NEW]  vertical snap scroll, virtualised window
web/src/components/samples/SampleCard.tsx        [NEW]  one full-viewport track
web/src/hooks/useSampleAutoplay.ts               [NEW]  IntersectionObserver -> play visible only
```

Buildable with existing data: use the real stream URL, seek into the track (roughly 25 percent in,
to land past the intro) and play a 30 second window. Needs care around the single-Howl `AudioEngine`.
Cleanest approach: samples take over the main player queue while the tab is mounted, and restore the
previous queue on exit. Attempting a second parallel audio pipeline would fight the engine.

### 2.9 Search

```
web/src/app/(main)/search/page.tsx                 [MOD]  keep server shell + moods
web/src/components/search/SearchExperience.tsx     [MOD]  rebuild UI, keep the fetch/debounce logic
web/src/components/search/SearchField.tsx          [NEW]  large field, voice button
web/src/components/search/VoiceSearchButton.tsx    [NEW]  Web Speech API, hidden when unsupported
web/src/components/search/TrendingChips.tsx        [NEW]  from browse rows, not invented
web/src/components/search/RecentSearches.tsx       [NEW]  localStorage
web/src/components/search/ResultTabs.tsx           [NEW]  All | Songs | Albums | Artists | Playlists
web/src/stores/search.ts                           [NEW]  recent searches
web/src/components/search/resultHelpers.ts         [KEEP]
```

Voice search: `webkitSpeechRecognition` is Chrome and Safari only. Feature-detect and hide the mic
entirely where unsupported rather than showing a dead button.

Trending searches: there is no trending-query endpoint. Deriving chips from `/api/trending` track and
artist names gives real, current content instead of a hardcoded list.

### 2.10 Library

```
web/src/app/(main)/library/page.tsx                    [MOD]
web/src/components/library/LibraryExperience.tsx       [MOD]  tabbed rebuild
web/src/components/library/LikedSongsCard.tsx          [NEW]  gradient hero card
web/src/components/library/LibraryTabs.tsx             [NEW]  Playlists | Albums | Artists | Downloads
web/src/components/library/CollectionExperience.tsx    [MOD]  restyle
web/src/components/library/LikeButton.tsx              [MOD]  Framer pulse on like
web/src/components/sections/TrackList.tsx              [MOD]  restyle, swipe rows, touch-friendly
web/src/components/sections/ChartList.tsx              [MOD]  restyle
```

Honesty constraints: **Downloads / offline does not exist** (no service worker, no cache storage).
Either cut the tab or implement it for real via a service worker, which is its own project. And
`Playlists` currently means "playlists you have opened", since there is no playlist creation. Local
user-created playlists are a reasonable, genuinely implementable addition (`stores/playlists.ts`,
localStorage) if you want that tab to be real. Flagging rather than assuming.

### 2.11 Profile / listening stats

```
web/src/app/(main)/profile/page.tsx                [NEW]
web/src/components/profile/ProfileExperience.tsx   [NEW]
web/src/components/profile/StatsSummary.tsx        [NEW]  top artists/genres, total minutes
web/src/components/profile/WrappedCard.tsx         [NEW]  shareable summary card
web/src/components/profile/StreakBadge.tsx         [NEW]
web/src/lib/stats.ts                               [NEW]  derive stats from library.recent
web/src/hooks useListeningStats.ts                 [NEW]
web/src/components/settings/SettingsExperience.tsx [MOD]  + accent toggle, + neutral mode, + motion
```

Real caveat: `library.recent` is capped at `MAX_RECENT = 60` and stores no per-play timestamp history
beyond the most recent entry ordering, so "total minutes" and streaks cannot be computed accurately
today. To make stats real, `stores/library.ts` needs a lightweight append-only play log
(`{ id, at, ms }`, capped and pruned). That is a small store change and it is the difference between
real stats and theatre. Recommend doing it.

### 2.12 Store extensions

```
web/src/stores/player.ts   [MOD]  + playNext(song)         insert after current, in BOTH queue+order
                                  + addManyToQueue(songs)
                                  + videoMode: boolean
                                  + lyricsOpen: boolean
                                  + optional session persistence (queue + position across reloads)
web/src/stores/library.ts  [MOD]  + playLog for real stats
web/src/stores/theme.ts    [MOD]  accentMode, neutralMode, palette
web/src/stores/lyrics.ts   [NEW]
web/src/stores/search.ts   [NEW]
web/src/stores/playlists.ts [NEW, conditional on 2.10 decision]
```

`playNext` is the notable gap: `addToQueue` only appends to the end of both arrays. Insert-after-
current has to update `queue`, remap every affected index in `order`, and hold `orderPos` steady.
Under shuffle this is subtle. It is the one store change that needs real care.

### 2.13 Dependencies

```
motion@^12   (the package formerly named framer-motion; React 19 compatible)
```

Nothing else. No colour-extraction library (we have a better tuned one), no lyrics SDK (the parser is
about 40 lines), no carousel library (CSS scroll-snap already works well here).

Use `LazyMotion` with a feature bundle and the `m` component rather than importing `motion` wholesale,
to keep the bundle small on a media-heavy app. Every animation must respect the existing
`prefers-reduced-motion` block in `globals.css`, which currently resets animation globally.

---

## 3. Build order

Each step is independently reviewable and leaves the app working.

| Step | Scope | Priority |
| --- | --- | --- |
| a | Theme, tokens, typography, palette modes, MotionProvider, UI primitives | P0 foundation |
| b | Layout shell: Sidebar, MobileNav, Topbar, `(main)/layout.tsx` | P0 |
| c | `PlayerBar`, retire the two old bars, SeekBar and controls restyle | P0 |
| d | Home: server shell, HomeExperience, MoodChips, QuickPicks, RecentGrid, RadioCard, smart cards | P0 + P1 |
| e | Now Playing: Sheet, ArtStage, tabs, lyrics subsystem, playback clock, queue integration | P0 |
| f | Search: field, voice, trending, tabs, recents | P0 |
| g | Library: tabs, liked hero card, swipe rows | P0 |
| h | Samples feed, swipe-to-queue, share card, ambient visualizer, profile stats | P1 + P2 |

Verification per step: `npm run typecheck`, `npm run lint`, `npm run build`. Note the sandbox cannot
reach the Flask API, so runtime data paths need checking against your deployed backend; I will keep
loading and error states explicit so failures degrade visibly rather than rendering blank.

---

## 4. Decisions needed before Step 2a

1. **Lyrics**: add LRCLIB (option A), or static-only (option B)?
2. **Video mode**: cut, or disabled-with-explanation affordance?
3. **Collaborative playlists and device handoff**: cut, or build as clearly-marked non-functional previews?
4. **Downloads tab**: cut, or replace with local user-created playlists?
5. **Base colour**: default to `neutral` (#0a0a0a as specced) or keep `tinted` (artwork-derived) as default, with the other available in Settings?
6. **Naming**: confirm Radio / Fresh Finds / New For You / Your Listening instead of the Spotify product names.
7. **Backend edits**: am I allowed to touch `catalog.py` (to add the `sleep` and `energetic` moods), or is the Flask layer off limits for this piece of work?

My defaults if you would rather I just proceed: A, disabled-affordance, cut, local playlists, tinted
default, renamed, and yes to the small `catalog.py` mood addition.
