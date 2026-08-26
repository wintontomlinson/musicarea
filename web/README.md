# MusicArea Web (Next.js frontend)

Next.js 16 (App Router) + React 19 + TypeScript + Tailwind. Catalogue pages are
server rendered against the Flask API, so they are SEO friendly; playback,
preferences and saved music are client state.

This is one of **two** frontends in the repository. See the root README for how
it relates to the legacy Flask-rendered app and which one actually deploys.

## Running locally

The Flask API must be running first (see the root README):

```bash
# from the repo root
.venv/bin/python app.py        # http://127.0.0.1:5000
```

Then:

```bash
cd web
cp .env.example .env.local     # defaults point at the local Flask dev server
npm install
npm run dev                    # http://localhost:3000
```

With the API down, every page still renders: shelves fall back to an empty
state and detail pages report that the catalogue is unreachable.

## Scripts

```bash
npm run dev        # dev server
npm run build      # production build
npm run start      # serve the production build
npm run typecheck  # tsc --noEmit
npm run lint       # eslint .
```

Lint config lives in `eslint.config.mjs` (flat config). Next 16 removed the
`next lint` command, which used to synthesise a config when none existed; this
repo never committed one, so linting silently did nothing until it was added.

## Environment

| Variable | Purpose |
| --- | --- |
| `FLASK_API_BASE` | Base URL of the Flask API. Server-only, read by `src/lib/api.ts` |
| `NEXT_PUBLIC_SITE_URL` | Public origin of this frontend, for canonical URLs, sitemap and Open Graph |

`FLASK_API_BASE` is deliberately not `NEXT_PUBLIC_`. Browser code never calls
Flask directly: it goes through the route handlers in `src/app/api/`, so the
internal service URL stays out of the client bundle. Flask sends no CORS headers,
so a direct browser call could not work anyway.

## Data flow

Server components call `src/lib/api.ts` directly (server to server). Catalogue
reads are cached per fetch (`next.revalidate`); the personalised feed is POSTed
with listening history and never cached.

Three route handlers exist only so client components can reach Flask without the
base URL leaving the server:

| Route | Used by |
| --- | --- |
| `GET /api/search?q=` | search suggestions and the All tab |
| `GET /api/search/songs?q=` | the Songs tab, which needs stream URLs |
| `GET /api/song/[id]` | the audio engine, resolving a stream for a stored track |

Search results are normalised in `api.searchAll()`. Upstream can return a null
`title` or `type`, which the declared types say is impossible; rows are cleaned
once at that boundary rather than guarded at each of the six render sites.

Detail pages distinguish **missing** from **unavailable** (`src/lib/entity.ts`).
Only an upstream 404 renders "not found"; an unreachable catalogue renders a
`noindex` "temporarily unavailable" page instead, so an outage cannot turn every
real URL into an indexable 404.

### URLs

Entity URLs are `/{kind}/{slug}--{id}`, joined with a **double** hyphen.
`slugify` collapses runs of non-alphanumerics into a single `-`, so a slug can
never contain `--`, which makes the first `--` an unambiguous boundary. A single
hyphen would not be: catalogue ids come from upstream as base64url-style tokens
that can themselves contain `-`, and splitting on the last hyphen truncated
those ids and 404'd the page.

## Player

- `src/stores/player.ts` holds playback state (queue, play order, position,
  volume, shuffle, repeat) and persists volume/shuffle/repeat. Shuffle keeps a
  separate play `order` over the natural queue, so toggling it never loses your
  place.
- `src/components/player/AudioEngine.tsx` owns the single Howl instance,
  subscribes to the store imperatively, and renders nothing.
- Surfaces (`MiniPlayer`, `FullPlayer`, `QueuePanel`, `PlaybackAlert`) and
  effect-only helpers (`KeyboardShortcuts`, `MediaSession`) mount once in the
  main layout, so playback survives route changes.

**Position travels one way, intent the other.** `setProgress` is only ever the
engine reporting where playback is. A seek is a separate action, `seekTo`, which
bumps a `seekSeq` counter the engine watches. Sharing one channel for both meant
the engine had to infer a seek by diffing `currentTime` against the audio with a
tolerance window, which could not express a seek to 0:00 at all: dragging the bar
to the far left, pressing Left under five seconds, or moving the OS scrubber to
the start all updated the label and then snapped back.

Unplayable tracks are skipped, but only up to a limit. With `repeat: 'all'` and a
queue where nothing resolves, each failure advanced the queue, which loaded,
which failed; the ceiling turns that into one visible message.

Keyboard: Space/k play-pause, Left/Right seek 5s (Shift = prev/next track),
Up/Down volume, m mute, s shuffle, r repeat. Shortcuts are ignored entirely when
nothing is queued, so Space still scrolls the page.

## Saved music

`src/stores/library.ts` keeps favourites and recently played in localStorage
under `musicarea:library:v1`. No account, nothing uploaded.

Stored records drop `downloadUrl`: those arrays hold five signed CDN links per
track that expire anyway, and the engine already resolves a stream on demand
through `/api/song/[id]`. Every mutating action hydrates from storage first,
because playback can begin before any screen that reads the library has mounted,
and writing from the empty initial state would erase what is on disk.

## Onboarding and profile

`src/stores/user.ts` holds the local profile, chosen languages and an
`onboardingComplete` flag, persisted to localStorage and mirrored to the
`ma_langs` cookie. `src/lib/languages.ts` reads that cookie on the server so the
SSR feed matches the listener's languages. A `hydrated` flag keeps returning
users out of the flow with no flash.

Reading cookies opts a route into dynamic rendering, which is why the home,
explore and search pages carry no `revalidate` export: per-fetch caching in
`lib/api.ts` is what caches them.

## Design system

Every colour resolves through a custom property declared in
`src/app/globals.css`. `tailwind.config.ts` holds no colour values of its own;
each entry points at one of those properties via
`rgb(var(--token-rgb) / <alpha-value>)`, which is what keeps opacity modifiers
such as `bg-accent/25` and `bg-surface/80` working. Tokens are stored as bare
`r g b` channels for exactly that reason.

The default palette:

- Background `#090613`, surfaces `#151026` / `#20183a`, scrim `#080411`
- Accent `#ff3bbf` with `#ff78d7`, brand gradient through purple to cyan `#4de7ff`
- Inter (variable) ahead of the system stack, heading scale `h1`..`h6`, glass
  panels, brand-tinted scrollbar

Because there are no hardcoded colours left in the components, adding a token or
retuning the palette is a change to two files rather than forty.

Two tokens exist only because the palette moves. Use `text-on-accent`, never
`text-white`, for anything sitting on `bg-accent` or `bg-brand`: the palette
decides whether light or dark ink is readable on the accent it generated, and a
yellow accent needs dark ink. And `--chrome-alpha` lets the sidebar, toolbar and
tab bar share `.chrome-panel` at different opacities.

Colours that carry a fixed meaning stay outside the token system on purpose: the
amber playback warning, the per-language and per-avatar identity tints in
`lib/config.ts`, the white play pill, and the selection rings and check badges
that sit on top of those fixed tints.

## Adaptive colour

The site takes its colours from the artwork in front of the listener. Album,
artist, song, playlist and mood pages drop in `<ThemeCover cover={...} />`, and
`<DynamicTheme />` (mounted with the audio engine in `(main)/layout.tsx`) resolves
a palette and writes it onto `<html>`, along with the `theme-color` meta tag so
mobile browser chrome follows too. Page artwork wins over the playing track, so
browsing an album tints the site to that record even while something else plays.
Listeners can turn the whole thing off in Settings, which is persisted under
`musicarea:theme:v1`.

`src/lib/color.ts` does the extraction, with no dependencies:

- The cover is requested through `/_next/image?...&w=64`, not from the CDN
  directly. That route is same-origin, so `getImageData` on the sampling canvas
  cannot be refused, which it would be for an opaque cross-origin image.
- Hue is voted on in 24 buckets, weighted by saturation and by closeness to mid
  lightness, so the result is the colour a person would name rather than the
  muddy average of the histogram.
- Only the hue travels from the artwork. Each token is then pulled until its
  **relative luminance** lands in a band, which is the part that makes this safe:
  HSL lightness is not perceived lightness, so pinning lightness instead would
  leave white-on-accent at 3.2:1 for pink and 1.1:1 for yellow. Banding luminance
  makes contrast roughly hue-invariant, and `--on-accent` flips to dark ink above
  the point where white stops clearing 3:1.
- The secondary hue keeps the direction the artwork suggests but is capped at 72
  degrees from the accent, so gradients stay analogous instead of sweeping through
  an unrelated colour family. The gradient's midpoint is additionally held
  wherever the chosen ink can be read over it.
- Anything unsamplable (the inline SVG fallback cover, a greyscale sleeve, a
  failed or slow request) resolves to the static brand palette. Extraction never
  rejects. Successes are cached per URL for the session; failures deliberately are
  not, so one dropped request does not pin an album to the brand palette forever.

`DEFAULT_PALETTE` in that file holds the same literals as the `:root` block, so
server rendering and the first paint use the brand palette and the adaptive one
arrives as a fade.

The fade is why the tokens are declared with `@property … syntax: '<number>+'`. An
untyped custom property can be swapped but not interpolated, so anything derived
from it snaps; registering the channels lets the transition happen on the
*variables*, and every colour, border, shadow and gradient built on them
cross-fades together from one rule on `:root`. Gradients could not have been faded
any other way, since `background-image` is not interpolable. Browsers without
`@property` just change palette instantly.

## Structure

```
web/src/
  app/
    layout.tsx              root layout: font, metadata, WebSite JSON-LD
    (main)/                 app shell group (sidebar + top bar + mobile nav)
      page.tsx              home         search/    explore/   charts/
      song/  album/  artist/  playlist/  mood/
      library/  liked/  recent/  settings/
    api/                    server-side proxies to Flask
    robots.ts, sitemap.ts   SEO
  components/
    layout/                 Sidebar, Topbar, MobileNav
    player/                 engine, surfaces, transport, MediaSession
    library/                LikeButton, collections
    search/                 SearchExperience and result helpers
    sections/               Hero, Carousel, MoodGrid, TrackList, ChartList
    theme/                  DynamicTheme (applier), ThemeCover (page marker)
    cards/ ui/ seo/         MediaCard, Icon, EmptyState, JsonLd
  lib/
    api.ts                  typed Flask client + search normalisation
    color.ts                artwork sampling and palette generation
    entity.ts               found / missing / unavailable for detail pages
    types.ts                response types (from real Flask shapes)
    utils.ts, config.ts, languages.ts
  stores/
    player.ts  library.ts  user.ts  theme.ts
```
