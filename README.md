# MusicArea

A music streaming web app with a recommendation engine that explains itself.

Every track the app suggests carries a plain-language reason ("Because you listen
to Pritam", "Plays well with Kesariya") and a full breakdown of the signals that
produced its score. The listening profile is built and stored in the browser, so
there is no sign up and no account.

Flask backend, vanilla JavaScript frontend, no build step. Catalog data comes
from the JioSaavn public endpoints.

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
| `templates/index.html` | App shell |
| `static/css/app.css` | Design system |
| `static/js/app.js` | Router, views, store, player |

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

**Quality.** Defaults to the highest the source offers, 320 kbps AAC. There is no
lossless tier upstream, so that is the ceiling and the app does not pretend
otherwise. High (160) and Data saver (96) are there for weak connections. If a
particular track is missing your chosen rung, it steps down for that track only
rather than failing. Switching mid-track keeps your position by waiting for the
new source to report its duration before seeking, since assigning `currentTime`
to an element still in `HAVE_NOTHING` is silently dropped.

**Crossfade.** Off by default, 1 to 12 seconds when enabled. Implemented with two
`<audio>` decks: the next track starts on the idle deck while the current one is
still playing, and the two are blended. The ramp uses an equal power curve
(`sin`/`cos`) rather than a linear one, so perceived loudness stays flat instead
of dipping through the middle of the blend. At the crossover both decks sit at
0.707 of target gain, which is the point of the curve.

Details that matter in practice:

- Only the active deck drives the UI. A deck that is fading out is marked
  retiring, so it cannot repaint state or trigger the next track.
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
  `r` repeat, `q` queue, `m` mute, `/` search, Shift plus arrows to seek.
- **Responsive.** Sidebar collapses to icons at 1180px, then to a bottom tab bar
  at 760px. Track lists drop to three columns at 900px. Verified with no
  horizontal overflow from 360px through 1920px. Respects
  `prefers-reduced-motion`.
- **Details.** Per route page titles, which give way to `Song · Artist |
  MusicArea` once something is playing, a footer, and an offline banner.

## Deploying

Push to a repository connected to Vercel. `vercel.json` builds `app.py` with
`@vercel/python` and bundles `templates/` and `static/`.

The upstream API is geo-sensitive: radio and station endpoints only respond to
Indian IPs, which is why relatedness is derived from playlist co-occurrence
instead. Nothing else in the pipeline depends on region.

## Credits

The JioSaavn API layer (`helpers.py`, `models.py`, and the entity routes) is
based on work by @ab_devs. The player, catalog layer, recommendation engine, and
frontend were built on top of it.
