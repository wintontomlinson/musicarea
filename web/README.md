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

Tokens live in `tailwind.config.ts` and `src/app/globals.css`:

- Background `#090613`, surfaces `#151026` / `#20183a`
- Accent `#ff3bbf` with `#ff78d7`, brand gradient through purple to cyan `#4de7ff`
- Inter (variable) ahead of the system stack, heading scale `h1`..`h6`, glass
  panels, brand-tinted scrollbar

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
    cards/ ui/ seo/         MediaCard, Icon, EmptyState, JsonLd
  lib/
    api.ts                  typed Flask client + search normalisation
    entity.ts               found / missing / unavailable for detail pages
    types.ts                response types (from real Flask shapes)
    utils.ts, config.ts, languages.ts
  stores/
    player.ts  library.ts  user.ts
```
