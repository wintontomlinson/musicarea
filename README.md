# MusicArea

A music streaming web app with a recommendation engine that explains itself.

Every track the app suggests carries a plain-language reason ("Because you listen
to Pritam", "Plays well with Kesariya") and a full breakdown of the signals that
produced its score. The listening profile is built and stored in the browser, so
there is no sign up and no account.

Catalog data comes from the JioSaavn public endpoints.

## Two frontends

The repository contains two complete frontends over one API, and it is worth
being plain about the state of that:

| | Legacy | Next.js |
| --- | --- | --- |
| Location | `templates/`, `static/` | `web/` |
| Stack | Flask-rendered shell, vanilla JS, no build step | Next 16 App Router, React 19, TypeScript, Tailwind |
| Served at | `/` by `app.py` | its own Vercel project |
| In `vercel.json`? | yes, with a catch-all route | no |

**`vercel.json` deploys only the Flask app**, so a deploy from this repository
serves the legacy frontend at every path and the Next app is not published at
all. The Next app is a presentation layer: it holds no catalogue logic and reads
the same `/api/*` routes documented below.

The Next app has now caught up on features and gone past in places. It covers
browse, search, the catalogue pages, the player, favourites, recently played,
playlists, generated mixes, stations, lyrics, crossfade and the visualizer, and
adds server rendering, per-page SEO and the "Why this" signal breakdown that
nothing displayed before. Both drive the recommendation engine from a local
listening log. Consolidating on one of them is an open decision rather than a
finished migration, but the case for the Next app is now much stronger than it was.

Everything below applies to the API and the recommendation engine, which both
frontends share. See `web/README.md` for the Next app.

## Running locally

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python app.py          # http://127.0.0.1:5000
```

Verification scripts:

```bash
.venv/bin/python scripts/verify_api.py       # 61 endpoint and output-quality checks
.venv/bin/python scripts/try_recommender.py  # prints ranked output for sample profiles
```

## Layout

| File | Role |
| --- | --- |
| `app.py` | Routes: the app shell plus the JSON API |
| `recommender.py` | The recommendation engine |
| `catalog.py` | Normalized, cached read layer over the upstream endpoints |
| `models.py` | Upstream payload to clean JSON |
| `helpers.py` | Stream URL decryption, TTL cache, HTTP session |
| `templates/index.html` | App shell (legacy frontend) |
| `static/css/app.css` | Design system (legacy frontend) |
| `static/js/app.js` | Router, views, store, player (legacy frontend) |
| `web/` | The Next.js frontend, documented in `web/README.md` |
| `scripts/stub_api.py` | Offline stand-in for this API, for frontend work without network access |

## How the recommendation algorithm works

Four stages. No ML dependencies: it is explicit arithmetic over signals that can
actually be observed from the catalog, which is also what makes it explainable.

### 1. Profile

The client keeps a local event log (`play`, `complete`, `repeat`, `like`,
`playlist_add`, `queue`, `skip`, `dislike`). Each event has a weight, and each is
decayed by age with a 21 day half life, so last week's obsession outranks last
month's. Collapsing the log produces:

- artist affinity, with skipped artists subtracted
- language distribution
- era centre, the weighted mean release year
- a mainstream score, from the average log play count of what you play
- the seed tracks, plus the set of everything already heard

### 2. Candidate generation

Five independent recall sources run in parallel. Using several matters: any
single source overfits, and a track found by more than one gets a corroboration
bonus later.

| Source | What it pulls |
| --- | --- |
| `artist` | Catalog of your highest affinity artists |
| `collab` | Item-item collaborative filtering (below) |
| `similar` | Catalog of the neighbourhood artists the CF stage discovers |
| `album` | Sibling tracks from the albums your seeds came from |
| `trend` / `fresh` | Charts and new releases in the languages you actually play |

**The collaborative filtering stage** is the interesting one. The upstream
"similar artists" field is always empty and the radio endpoints are geo-blocked,
so relatedness is derived instead: editorial playlists are treated as the users
of a classic CF matrix. Playlists are searched for your seed tracks and artists,
then two things are counted across the results:

- how many distinct curated playlists hold each song, which scores the song
- how many tracks each artist has across those playlists, which yields an artist
  neighbourhood, effectively a computed "similar artists" list

The neighbourhood then feeds a second recall pass, and a discounted version of it
folds into the artist signal. Without it, a station seeded from one song runs dry
the moment the per-artist cap is hit and collapses into generic trending.

### 3. Scoring

Seven normalized signals, blended with weights:

| Signal | Weight | Meaning |
| --- | --- | --- |
| `artist` | 0.26 | Direct affinity, or 0.75x the derived neighbourhood affinity |
| `collab` | 0.22 | Playlist co-occurrence, log scaled |
| `language` | 0.13 | Share of your listening in this language |
| `era` | 0.10 | Gaussian falloff from your era centre |
| `popularity` | 0.10 | Closeness to your mainstream lean |
| `freshness` | 0.09 | How recent the release is |
| `recall` | 0.10 | Confidence in the source, plus a multi-source bonus |

Then the penalties: already-heard tracks are pushed down rather than removed,
alternate cuts (lofi flips, remixes, instrumentals) sit behind the original,
skipped artists are damped, and dislikes are dropped outright.

Five weight profiles reshape the same signals per surface. `radio` leans on
co-listening and ignores freshness; `discover` almost zeroes out artist affinity;
`fresh` inverts toward new releases; `mood` leans on artist and language, since
belonging to the mood is already true of every candidate.

Reasons are only shown when they are actually about you. On surfaces where
membership is a given, a row whose top signal is popularity or freshness gets no
reason at all and the list shows play counts instead. A shelf where every line
reads "Big with everyone right now" carries no information.

### 4. Diversity aware re-ranking

Sorting by score alone returns six tracks by one artist. A greedy MMR style pass
discounts each candidate by how much it repeats what is already picked, with hard
caps of two per artist and two per album, and reserves every fifth slot for an
artist you have no history with. Alternate cuts of a composition are collapsed
before ranking so the same song never appears twice.

## Home

Home carries personal shelves and one row of what is popular. It previously
appended every browse row as well, which came to eleven shelves and 5.2 screens
of scrolling, with **six of the eleven identical to what Browse already showed**.

| | before | after |
| --- | --- | --- |
| shelves | 11 | 8 |
| screens of scrolling | 5.2 | 3.1 |
| images | 214 | 125 |
| rows duplicated from Browse | 6 | 1 (Trending, with a Show all link) |

A returning listener gets a greeting bar and a **Jump back in** grid, which is
what every major player leads with and the main thing missing here. The full
explainer hero is kept for a first visit, where describing the app is the useful
thing to do, along with the moods so there is something to dig into.

Shelves longer than five items get scroll arrows on pointer devices.

### Stored songs lost their artists

`artistsOf()` only understood the API's role-bucketed shape, but `Store.slim()`
saves a flat array. Every song read back from storage therefore resolved to no
credits and rendered as "Unknown artist": the whole library, the recent list and
the jump-back-in tiles.

It also quietly corrupted the taste profile. `logEvent` re-slims whatever is
playing, so replaying a stored track wrote a history entry with **no artists at
all**, and the profile had nothing to rank by. That is why the greeting read
"Learning on top" while the player bar showed the artists correctly.

### Replaying from storage

`Store.slim()` deliberately omits `downloadUrl`, because the listening history is
POSTed to the recommender on every feed request and five URLs per entry across
hundreds of entries would bloat that payload badly.

The cost, unnoticed until it was tested, was that **nothing replayed from storage
had a stream**. Clicking a liked song, a recently played track or a track in a
local playlist failed silently, autoplay then took over, and an unrelated track
started. Streams are now resolved on demand, in batches of 25, at the point they
are needed. `play()` also remembers which track was clicked and finds it again
after resolution, since filtering can shift positions and starting the wrong song
is worse than a short delay.

### Search, browse and library

All three used to be text and glyphs. They now show the music they contain:

- **Search** opens on recent searches plus twelve language tiles built from what
  is charting in each, and results lead with a "Top result" card that promotes an
  artist over a song when the query looks like an artist name.
- **Browse** keeps the language selector but adds the same artwork tiles, and each
  one opens a language page of its own.
- **Library** tiles carry a four cover collage of their actual contents rather
  than a generic icon, with play buttons and inline rename and delete.

Language tiles reuse the mood tile treatment, including the static blur, for the
same reason: sleeve art carries its own typography and a label sits over it.

### Mood tiles

Moods are tiles with real artwork rather than flat colour blocks. Each borrows
four covers from the tracks that mood actually returns, laid out as a collage
under a wash in the mood's own hue.

Getting there took two corrections, both obvious once rendered:

- Editorial playlist covers have the playlist's **name typeset into the artwork**,
  so the tile showed "Romance" sitting on top of a faint "Most Streamed Love
  Songs". Album art is used in preference for that reason.
- Album art carries release titles too, so a single full-size cover always
  competed with the label. Four quarter-size covers plus a small static blur turn
  the artwork into colour and texture while the mood name stays crisp.

The blur is static. That matters: it was *animating* a blur that cost 44 FPS, and
measured before and after, these tiles cost nothing.

### Stream URL padding

Stream URLs are 3DES encrypted upstream and the plaintext carries PKCS#5 padding.
The decrypt only stripped NUL bytes, so every URL came out ending in four 0x04
bytes and reached the browser as `..._320.mp4%04%04%04%04`. The CDN happened to
serve it anyway, which is why it went unnoticed, but nothing guaranteed that: one
stricter proxy or CDN config and every track 404s. The pad length is now read
from the final byte and removed, with a control character filter behind it.

## Smoothness

The interface ran at **4 FPS** at rest. Isolated by toggling one thing at a time:

| condition | FPS |
| --- | --- |
| as shipped | 4.1 |
| ambient layer hidden | 46.4 |
| ambient shown, blur removed | 38.6 |
| blur kept, animation stopped | 47.7 |
| all backdrop-filters removed | 6.8 |

So backdrop-filter was not the problem, and neither blur nor motion was fatal on
its own. The cost was specifically **moving a blurred element**: three 952px
circles carrying `filter: blur(120px)` on infinite transform animations, which
forces the blur to re-rasterise every frame.

The ambient wash is now painted with radial gradients on a single element. A
gradient is soft to begin with, so it needs no filter and no animation to look
like an aurora.

Three smaller layout-thrash fixes went in alongside:

- the seek bar animated `width`, now `transform: scaleX`
- the visualizer wrote `height` on 28 bars every frame, now `transform: scaleY`
- shelves get `content-visibility: auto` so offscreen ones cost nothing

| measurement | before | after |
| --- | --- | --- |
| idle | 4.1 FPS | 50.5 FPS |
| scrolling the feed | 4.9 FPS | 49.9 FPS |
| now playing, live visualizer | n/a | 60 FPS, zero janky frames |
| mobile idle (390px) | 4.1 FPS | 48.7 FPS |
| FCP | 836ms | 152ms |
| LCP | 836ms | 316ms |

Measured in headless Chromium with software rendering and no GPU, so these are a
floor rather than a best case.

### Player state note

Turning shuffle **off** mid playback used to reset the queue pointer to position
0. With shuffle on that is correct, because the rebuilt order puts the current
track first, but switching off restores the original list order where the track
can sit anywhere. The result was that Next jumped backwards and the queue drawer
marked the wrong row as playing. The pointer is now looked up rather than
assumed.

### Data quality notes

Two upstream quirks that materially affect output, both handled:

- **Credits.** An artist can hold several credits on one track. Reading only the
  last one drops performers who also write their own lyrics, which broke both the
  artist cap and the affinity signal. All credits are collected and an artist is
  only ignored when every one of their credits is non-musical (lyricist, cast).
  Without this, a film's lead actor is credited on its soundtrack and a 2022
  Bollywood track drags that actor's 1980s catalogue into the feed.
- **Duplicates.** The same recording appears repeatedly (`Kesariya` and
  `Kesariya (From "Brahmastra")`). Tracks are keyed on normalized title plus
  shared artists, so a variant of something you have already heard is suppressed.
- **Literal search.** Upstream search does not understand phrases. `party
  anthems punjabi` returns zero results while `punjabi party` returns forty, so
  each mood carries a short `keyword` alongside its broad `query` purely so it
  can be combined with a language. This is what lets a mood set actually follow
  the listener: without it, a Punjabi listener opening Party is ranked against a
  pool that is 99% Hindi and there is nothing for the ranking to find.

## API

Everything is namespaced under `/api`. `GET /api` returns the index.

### Recommendations

| Endpoint | Notes |
| --- | --- |
| `POST /api/feed` | The personalised home screen. Body: `{history, mood, limit}`. All shelves are scored from one shared candidate pool. |
| `GET /api/radio/<song_id>` | Station seeded from one track |
| `GET /api/artists/<artist_id>/radio` | Station seeded from an artist |
| `POST /api/similar` | "More like this". Body: `{ids, limit}` |
| `POST /api/moods/<mood_id>` | Mood set ordered by taste fit. Body: `{history, limit}`. A plain `GET` returns the catalogue order and reports `meta.personalised: false`. |

Recommended tracks carry a `recommendation` block:

```json
{
  "rank": 1,
  "score": 0.858,
  "reason": "Because you listen to Pritam",
  "signals": { "artist": 1.0, "collab": 0.92, "language": 1.0, "era": 1.0,
               "popularity": 0.79, "freshness": 0.0, "recall": 0.79 },
  "sources": ["collab"],
  "discovery": false,
  "familiar": false
}
```

### Browse and catalog

`GET /api/browse`, `/api/trending`, `/api/charts`, `/api/new-releases`,
`/api/featured`, `/api/songs`, `/api/songs/<id>`, `/api/songs/<id>/lyrics`,
`/api/albums`, `/api/playlists`, `/api/artists/<id>`, `/api/artists/<id>/songs`,
`/api/artists/<id>/albums`, `/api/search`, `/api/search/{songs,albums,artists,playlists}`,
`/api/health`.

## Audio and settings

`#/settings` holds everything about playback.

**Quality.** Defaults to the highest the source offers, 320 kbps AAC.

There is no lossless tier and this is worth being plain about. Sampled across
sixteen tracks, the catalogue publishes exactly five rungs, 12/48/96/160/320 kbps,
every one of them AAC in an MP4 container on the same CDN. No FLAC, ALAC or WAV
variant exists to request. 320 kbps is therefore a real ceiling rather than a
setting, and a "lossless" switch in this app would do nothing but mislabel the
same AAC stream.

What the app does instead is guarantee you are actually getting the ceiling. The
badge beside the volume slider reports the rung **in use**, not the one asked
for, and turns amber when a particular track forced a step down. High (160) and Data saver (96) are there for weak connections. If a
particular track is missing your chosen rung, it steps down for that track only
rather than failing. Switching mid-track keeps your position by waiting for the
new source to report its duration before seeking, since assigning `currentTime`
to an element still in `HAVE_NOTHING` is silently dropped.

**Crossfade.** On by default at 6 seconds, adjustable from 1 to 12 or off.
Implemented with two `<audio>` decks: as the current track nears its end the next
one starts on the idle deck and rises over its tail, the way Apple Music does.
The ramp uses an equal power curve (`sin`/`cos`) rather than a linear one, so
perceived loudness stays flat instead of dipping through the middle of the blend.
At the crossover both decks sit at 0.707 of target gain, which is the point of
the curve.

**The next track is buffered before the blend starts.** This is the part that
decides whether a crossfade sounds right. Fetching the incoming track at the
moment the fade begins works on a fast connection and falls apart on anything
slower: the incoming side starts silent and leaves a hole in the middle of the
blend. The idle deck is loaded around fifteen seconds ahead, and the fade reuses
that buffer rather than reassigning `src`, which would throw it away.

Preloading also makes the crossfade-off path **gapless**. With crossfade
disabled the handover becomes a 60ms blend into the already buffered deck:
inaudible, but it means playback never stalls waiting for the next track. Loading
onto the current deck instead, which is what it used to do, always left a gap.

Details that matter in practice:

- Only the active deck drives the UI. A deck that is fading out is marked
  retiring, so it cannot repaint state or trigger the next track.
- The overlay and the player bar are two sets of controls driven by one delegated
  handler and one state sync, so they cannot disagree.
- A manual skip uses a shorter blend, capped at 1.2s, so the button still feels
  immediate.
- Crossfade is bypassed when Repeat one is on.
- Starting a track normally cancels any blend in progress and silences the other
  deck, so a retiring track can never keep playing underneath.
- The visualizer taps both decks. A media element can only ever have one source
  node, so attachment is guarded; an unrouted deck would go silent.

**Sleep timer.** 15 to 60 minutes, and it fades out over six seconds rather than
cutting off mid bar.

**Autoplay and visualizer** can both be switched off.

## Generated mixes

`POST /api/mixes` builds ready made playlists from the profile. Three kinds,
because one kind alone is monotonous:

- an **artist mix** per top artist, that artist plus the neighbourhood the CF
  stage derives
- a **language mix** per language actually played
- a **discovery mix** of artists with no listening history at all

Two things the first attempt got wrong, both caught by inspecting the output:

- Reusing one shared candidate pool for every artist mix dragged the listener's
  other genres in, so a Punjabi rap track landed in a Bollywood playback mix.
  Each artist mix now gets its own recall pass seeded from that artist, with the
  broad trending and new release arms switched off.
- Two artist mixes shared half their tracks, because one singer performs most of
  the other's compositions. Mixes are now built against a growing exclusion set,
  so they come out disjoint.

Mixes can be played directly, saved as an editable playlist, or rebuilt. They are
requested separately from the feed and cached for ten minutes, because a cold
build takes several seconds and must not hold up first paint.

## Editing your library

- Playlists can be renamed and deleted, and tracks removed from them.
- Liked songs can be removed from the liked view itself.
- Recently played can be cleared without touching the taste profile.
- Everything destructive asks first, through an in-app dialog rather than
  `confirm()`. The native dialogs block the page, cannot be styled and read as
  a browser artefact rather than part of the app.

## Third party naming

The catalogue provider's brand does not appear anywhere in the interface. That
needed more than deleting one footer line: the provider ships its own name as the
curator on every editorial playlist, so chart tiles were captioned with it, and it
serves branded placeholder artwork for entities with no cover. `clean_text` strips
the brand from any display string, provider permalinks are dropped from every
payload, and placeholder art is filtered server side so the app draws its own.
Attribution stays here in the README, where crediting the data source is honest
rather than decorative.

## The app

- **Player.** Queue with shuffle and repeat, seek, volume, crossfade, bitrate
  switching that keeps your position, automatic fallback to a lower bitrate on a
  stream error, Media Session integration for OS and lock screen controls, and a
  station that extends itself before the queue runs out.
- **Now playing.** Full screen view with a real Web Audio frequency visualizer,
  queue, lyrics, and the "Why this" signal breakdown.
- **Library.** Liked songs, recently played, and local playlists, all in
  `localStorage`. Clearing it resets the recommender to a cold start.
- **Keyboard.** Space or `k` play/pause, `n`/`p` track, `l` like, `s` shuffle,
  `r` repeat, `q` queue, `m` mute, `/` search, `Esc` to close. Left and right
  arrows seek 5 seconds on their own and 30 with Shift; up and down set volume.

  Three things this gets right that are easy to get wrong:

  - Letter shortcuts are matched case insensitively, so Shift and Caps Lock do
    not break them. `event.key` reports `S` for both Shift+s and caps-on s.
  - Arrows work without a modifier. Requiring Shift to seek is the single most
    common complaint about a web player's keys.
  - Ctrl, Cmd and Alt combinations are ignored entirely, so `Ctrl+R` reloads
    without also toggling repeat and `Ctrl+L` reaches the address bar without
    liking the track.
  - Space and Enter are left to whichever control has focus, so buttons and
    switches stay operable by keyboard.
- **Responsive.** Verified with no horizontal overflow at sixteen widths from
  320px through 1920px, and the first shelf stays above the fold on every phone
  size. Respects `prefers-reduced-motion`.

  | width | layout |
  | --- | --- |
  | above 1400 | full sidebar, hero art at full size, four stats across |
  | 1080 to 1400 | hero art scaled down, stats shrink to fit one row |
  | 1180 and below | sidebar collapses to icons, header picks up the wordmark |
  | 1080 and below | hero goes single column, art dropped rather than shrunk |
  | 900 and below | track lists drop to three columns |
  | 760 and below | sidebar becomes a bottom tab bar, header carries the mark |
  | 420 and below | tighter hero type and spacing |

  Exactly one logo mark is visible at any width. The sidebar owns it on wide
  screens and hands it to the header when it collapses, so the two never appear
  together.

### Navbar

Three grid tracks rather than a flex row, so the search field stays optically
centred however wide the flanking clusters get. Left holds the back and forward
history buttons, or the brand once the sidebar collapses. Right holds the
explainability badge and settings, both of which drop out on phones to leave
room for search.

### Hero

Two columns on wide screens: copy on the left, three covers fanned on the right,
pulled from the feed itself so the panel is real content rather than decoration
and the dead space on a 1920 screen is filled. The offsets deliberately stop
short of the container edge, since a rotated square pokes outside its own box and
the hero clips overflow. The art renders only when the feed supplied three
covers, and is dropped entirely below 1080px instead of being shrunk into
illegibility.
- **Details.** Per route page titles, which give way to `Song · Artist |
  MusicArea` once something is playing, and an offline banner.

## Deploying

Push to a repository connected to Vercel. `vercel.json` builds `app.py` with
`@vercel/python` and bundles `templates/` and `static/`, and routes every path to
it. That serves the API and the legacy frontend together.

The Next.js app in `web/` is not covered by that config. Publishing it needs its
own Vercel project rooted at `web/`, with `FLASK_API_BASE` pointing at this
deployment and `NEXT_PUBLIC_SITE_URL` at its own domain.

The upstream API is geo-sensitive: radio and station endpoints only respond to
Indian IPs, which is why relatedness is derived from playlist co-occurrence
instead. Nothing else in the pipeline depends on region.

## Credits

The JioSaavn API layer (`helpers.py`, `models.py`, and the entity routes) is
based on work by @ab_devs. The player, catalog layer, recommendation engine, and
frontend were built on top of it.
