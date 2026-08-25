# MusicArea Web (Next.js frontend)

A Next.js 14 (App Router) + TypeScript + Tailwind frontend for MusicArea. It
renders on the server against the existing Flask API, so catalogue pages are
SSR/SEO friendly while personalised state stays client side.

**Phase 1** delivered the scaffold, design system, app shell (sidebar, top bar,
mobile nav), an SSR home page with real data, and the SEO baseline.

**Phase 2** adds the full music player: a Howler.js audio engine, a Zustand
player/queue store, a persistent mini player, a full-screen player with a
swipe-down dismiss gesture, a queue panel with drag-to-reorder, keyboard
shortcuts, and MediaSession integration for OS/lock-screen controls.

Search and catalogue detail pages arrive in later phases.

## Player architecture

- `src/stores/player.ts` holds all playback state (queue, play order, current
  position, volume, shuffle, repeat) and persists volume/shuffle/repeat to
  localStorage. Shuffle keeps a separate play `order` over the natural queue so
  toggling it never loses your place.
- `src/components/player/AudioEngine.tsx` owns the single Howl instance and
  subscribes to the store: it loads the current track, honors play/pause,
  volume and seeks, reports progress, and advances the queue on end. It renders
  nothing.
- The surfaces (`MiniPlayer`, `FullPlayer`, `QueuePanel`) and the effect-only
  helpers (`KeyboardShortcuts`, `MediaSession`) are mounted once in the main
  layout so playback survives route changes.
- Stream URLs come from each song's `downloadUrl` (320kbps AAC preferred). When
  a queued track lacks them, the engine resolves full details via the
  `/api/song/[id]` route handler, which proxies Flask.

Keyboard: Space/k play-pause, Left/Right seek 5s (Shift = prev/next track),
Up/Down volume, m mute, s shuffle, r repeat.

## Architecture

- **Two services.** This frontend deploys to Vercel; the Flask API deploys
  separately (Render/Railway). They talk over HTTPS.
- **Server-to-server data.** Server components fetch from Flask via `src/lib/api.ts`.
  Catalogue responses use ISR (`revalidate: 300`); the personalised feed is
  POSTed with listening history and never cached.
- **Single data source.** All music data comes from Flask, which wraps JioSaavn.

## Running locally

The Flask API must be running first (see the repo root README):

```bash
# from repo root
.venv/bin/python app.py        # http://127.0.0.1:5000
```

Then the frontend:

```bash
cd web
cp .env.example .env.local     # defaults point at the local Flask dev server
npm install
npm run dev                    # http://localhost:3000
```

## Environment

| Variable | Purpose |
| --- | --- |
| `FLASK_API_BASE` | Base URL of the Flask API for server-to-server fetches |
| `NEXT_PUBLIC_SITE_URL` | Public origin of this frontend, used for canonical URLs, sitemap and Open Graph |

## Scripts

```bash
npm run dev        # dev server
npm run build      # production build
npm run start      # serve the production build
npm run typecheck  # tsc --noEmit
npm run lint       # next lint
```

## Design system

Tokens live in `tailwind.config.ts` and `src/app/globals.css`:

- Background `#0A0A0A`, surfaces `#111` / `#1A1A1A`
- Accent coral `#FF4D6D`, secondary purple `#7B2FBE`, brand gradient between them
- Inter (variable), heading scale, glassmorphism (`.glass`), noise overlay
  (`.noise`), brand-tinted custom scrollbar

## Deploying

- **Frontend:** deploy `web/` to Vercel. Set `FLASK_API_BASE` to the deployed
  Flask URL and `NEXT_PUBLIC_SITE_URL` to the Vercel domain.
- **API:** deploy the Flask app at the repo root to Render or Railway.

## Structure

```
web/src/
  app/
    layout.tsx            root layout: fonts, metadata, WebSite JSON-LD
    (main)/               app shell group (sidebar + top bar + mobile nav)
      page.tsx            SSR home
      search|explore|...  routes (stubs until later phases)
    robots.ts, sitemap.ts SEO
  components/
    layout/               Sidebar, Topbar, MobileNav
    cards/                MediaCard
    sections/             Hero, Carousel, MoodGrid
    ui/                   Icon, EmptyState, ComingSoon
  lib/
    api.ts                typed Flask client
    types.ts              response types (from real Flask shapes)
    utils.ts              image/url/format helpers
    config.ts             site constants
```
