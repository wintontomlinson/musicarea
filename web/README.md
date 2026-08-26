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

To work on the personalised surfaces without network access, or without building
up a real listening profile first, run the stub API instead:

```bash
python3 scripts/stub_api.py &                    # from the repo root, port 5099
cd web && FLASK_API_BASE=http://127.0.0.1:5099 npm run dev
```

It serves the real payload shapes, including the awkward ones: a cold versus warm
feed, `heavy-rotation` items with no recommendation block, a 404 from the lyrics
endpoint, and search results with null titles.

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

## Personalisation

The recommendation engine is server side but **stateless**: no accounts, no
database. It rebuilds the listening profile on every request from a log the
browser sends it, so `src/stores/history.ts` is the input to the whole algorithm.

Before it existed the home page called the feed endpoint from a server component
with `history: []`, which server components have no way to improve on since they
cannot read localStorage. The result was that `coldStart` was permanently true,
four of the feed's five shelves were never emitted, and the ranking had nothing to
rank by. Home is now split: editorial shelves stay server rendered, and
`PersonalSection` makes the real request from the client.

### The event log

Append-only, one row per event, capped at 400 to match the server. Events and
their weights mirror `EVENT_WEIGHTS` in `recommender.py`:

| Event | Weight | Emitted when |
| --- | --- | --- |
| `play` | 1.0 | 12 seconds into a track, so a scroll cannot rewrite a profile |
| `complete` | 1.7 | a track ends having played 90% or more |
| `repeat` | 2.2 | a track ends under repeat-one |
| `like` | 2.6 | favourited (never on unfavouriting) |
| `playlist_add` | 2.0 | reserved; no user playlists yet |
| `queue` | 1.1 | added to the queue by hand |
| `search_play` | 1.3 | played from search results |
| `skip` | −0.7 | skipped by hand under 25% played |
| `dislike` | −2.4 | "not for me" |

Only the fields the server keeps go on the wire: `id`, `name`, `language`,
`year`, `playCount`, `event`, `at` and `artists[{id,name}]`. The body limit is
128 KiB and the whole log is posted on every request, so at 400 entries the
budget is about 300 bytes each; including `image` or `downloadUrl` would break it.
Measured, a full 400-entry log is around 68 KiB.

Autoplay never writes to the log. A station appended by the player is not a
choice the listener made, so `extendQueue` exists alongside `addToQueue`
specifically to avoid recording one.

### Caching is required, not an optimisation

Flask rate-limits the recommender routes to 35 requests a minute and keys the
bucket on the socket address. Because these calls arrive through this app's route
handlers, every visitor shares one bucket. Neither response can be cached at the
HTTP layer either, since both are POSTs keyed on browser state. `lib/personalised.ts`
therefore holds a client-side cache keyed on the log's revision: four minutes for
the feed, ten for mixes (a cold mix build runs several recall passes), with
single-flight and a back-off on 429.

### Surfaces

- **Made for you** mixes, from `POST /api/mixes`: an artist mix, a language mix
  and a discovery mix, disjoint from each other. A mix has no page to link to, so
  the tile plays it.
- **Feed shelves**, from `POST /api/feed`: `made-for-you`, `because-you-played`,
  `discover`, `fresh-for-you` and `heavy-rotation`. The last is a record of what
  was played rather than a prediction, and carries no `recommendation` block.
- **Why this**, in the full player: the reason plus the ranked signal breakdown.
  Every recommended track has carried this all along and nothing displayed it.
- **Taste profile**, on home: `profile.strength`, with the same formula computed
  locally so the bar is populated before the first response.

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
  hooks/
    usePersonalised.ts      feed + mixes, keyed on the log revision
  stores/
    player.ts  library.ts  user.ts  history.ts
```
