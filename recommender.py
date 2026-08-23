"""
recommender.py  |  MusicArea

A hybrid music recommendation engine.

The pipeline has four stages, which is roughly how the big streaming services
structure theirs:

  1. PROFILE      Turn a raw listening log into a time decayed taste profile.
  2. CANDIDATES   Fan out across five independent recall sources so the pool is
                  both relevant and wide (a single source always overfits).
  3. SCORE        Blend the per candidate signals into one number, with
                  penalties for things the listener already knows or skipped.
  4. RE-RANK      Greedy MMR style selection that trades a little relevance for
                  diversity, plus reserved exploration slots.

Every returned track carries a human readable `reason` and the raw `signals`
that produced its score, so the UI can be honest about why a song is there.

No third party ML dependencies: the whole thing is explicit arithmetic over
signals we can actually observe from the catalog.
"""

import hashlib
import math
import re
import time
from collections import defaultdict
from typing import Dict, Iterable, List, Optional

import catalog

# ---------------------------------------------------------------------------
# Tunables
# ---------------------------------------------------------------------------

# How much each kind of interaction says about taste. Negative values are
# signals of dislike.
EVENT_WEIGHTS = {
    "play": 1.0,
    "complete": 1.7,
    "repeat": 2.2,
    "like": 2.6,
    "playlist_add": 2.0,
    "queue": 1.1,
    "search_play": 1.3,
    "skip": -0.7,
    "dislike": -2.4,
}

# Taste ages out. A track you loved three weeks ago counts half as much as one
# you loved today.
HALF_LIFE_DAYS = 21.0

# Relative importance of each scoring signal. These sum to 1.0 for readability.
WEIGHTS = {
    "artist": 0.26,      # affinity for the credited artists
    "collab": 0.22,      # editorial playlist co-occurrence (item-item CF)
    "language": 0.13,    # matches the languages you actually play
    "era": 0.10,         # release window you gravitate to
    "popularity": 0.10,  # mainstream vs deep-cut fit
    "freshness": 0.09,   # recency of the release
    "recall": 0.10,      # prior on the source that surfaced the track
}

# Different surfaces want different behaviour from the same signals. A station
# seeded from one track should stay in that track's neighbourhood; a discovery
# shelf should actively avoid artists you already know.
WEIGHT_PROFILES = {
    "default": WEIGHTS,
    "radio": {
        "artist": 0.28, "collab": 0.34, "language": 0.14,
        "era": 0.10, "popularity": 0.06, "freshness": 0.02, "recall": 0.06,
    },
    "discover": {
        "artist": 0.08, "collab": 0.30, "language": 0.16,
        "era": 0.10, "popularity": 0.08, "freshness": 0.16, "recall": 0.12,
    },
    "fresh": {
        "artist": 0.22, "collab": 0.12, "language": 0.16,
        "era": 0.02, "popularity": 0.08, "freshness": 0.34, "recall": 0.06,
    },
}

# Prior confidence per recall source, used by the "recall" signal.
SOURCE_PRIOR = {
    "artist": 0.92,
    "collab": 0.86,
    "similar": 0.80,
    "album": 0.70,
    "fresh": 0.62,
    "trend": 0.58,
    "mood": 0.66,
    "chart": 0.60,
}

# Diversity: multiplicative penalty per already selected item sharing a facet.
ARTIST_PENALTY = 0.42
ALBUM_PENALTY = 0.55
# Language variety is nice, but a listener who only plays one language should
# not be pushed out of it. Only bite after a run of the same language.
LANGUAGE_PENALTY = 0.97
LANGUAGE_PENALTY_AFTER = 3

MAX_PER_ARTIST = 2
MAX_PER_ALBUM = 2

# One in every EXPLORE_EVERY slots is reserved for a track by an artist the
# listener has no history with. Without this the feed collapses into a loop of
# the same six artists.
EXPLORE_EVERY = 5

DEFAULT_LANGUAGES = ["hindi", "english", "punjabi"]


# ---------------------------------------------------------------------------
# Stage 1: taste profile
# ---------------------------------------------------------------------------

def _now_ms() -> float:
    return time.time() * 1000.0


def _decay(timestamp_ms: Optional[float], now_ms: float) -> float:
    if not timestamp_ms:
        return 0.35  # unknown age: count it, but quietly
    age_days = max(0.0, (now_ms - float(timestamp_ms)) / 86_400_000.0)
    return 0.5 ** (age_days / HALF_LIFE_DAYS)


def _to_year(value) -> Optional[int]:
    try:
        year = int(str(value)[:4])
    except (TypeError, ValueError):
        return None
    return year if 1900 < year < 2100 else None


def _norm_popularity(play_count) -> float:
    """Map a play count onto 0..1. 1e3 plays -> 0, 1e8 plays -> 1."""
    try:
        count = float(play_count or 0)
    except (TypeError, ValueError):
        return 0.5
    if count <= 0:
        return 0.5
    return _clamp((math.log10(count) - 3.0) / 5.0)


def _clamp(value: float, low: float = 0.0, high: float = 1.0) -> float:
    return max(low, min(high, value))


# Credits that say nothing about how a song sounds. Leaving these in wrecks the
# artist signal: a film's lead actor is credited on its soundtrack, so a 2022
# Bollywood track would pull in that actor's 1980s catalogue.
NON_MUSICAL_ROLES = {"starring", "lyricist", "actor", "actors", "cast"}


def _song_artists(song: dict) -> List[dict]:
    """Ordered musical credits: singers and composers, no lyricists or cast."""
    artists = song.get("artists") or {}

    # One artist can appear several times in `all` with different roles: an
    # artist who sings and writes their own lyrics is listed as both. Collect
    # every role, and only discard someone whose credits are ALL non-musical.
    roles: Dict[str, set] = defaultdict(set)
    for artist in artists.get("all") or []:
        if artist.get("id"):
            roles[artist["id"]].add((artist.get("role") or "").lower())

    def musical_role(aid: str) -> Optional[str]:
        """None when this credit should be ignored for taste purposes."""
        found = roles.get(aid)
        if not found:
            return ""
        performing = found - NON_MUSICAL_ROLES
        if not performing:
            return None
        return sorted(performing)[0]

    picked, seen = [], set()

    def collect(bucket: str, drop_non_musical: bool = True):
        for artist in artists.get(bucket) or []:
            aid = artist.get("id")
            if not aid or aid in seen:
                continue
            role = musical_role(aid)
            if drop_non_musical and role is None:
                continue
            seen.add(aid)
            picked.append({"id": aid, "name": artist.get("name") or "",
                           "role": role or (artist.get("role") or "")})

    collect("primary")
    collect("featured")
    if not picked:
        # Some payloads only populate the flat `all` list.
        collect("all")
    return picked


# Alternate cuts of a track. Real releases, but a feed full of them feels broken.
VERSION_MARKERS = (
    "lofi", "lo-fi", "remix", "instrumental", "karaoke", "cover", "slowed",
    "reverb", "mashup", "unplugged", "acoustic", "reprise", "recreated",
    "dance mix", "chill mix", "revisited", "backing track", "sped up",
)

_PARENTHETICAL = re.compile(r"\s*[\(\[][^\)\]]*[\)\]]")
_NON_WORD = re.compile(r"[^a-z0-9]+")


def _normalize_title(name: Optional[str]) -> str:
    text = (name or "").lower()
    text = _PARENTHETICAL.sub(" ", text)
    return _NON_WORD.sub(" ", text).strip()


def _title_key(song: dict) -> str:
    """Identity of a composition, ignoring the 'From "Movie"' suffix noise.

    JioSaavn frequently carries the same recording several times over: `Kesariya`
    and `Kesariya (From "Brahmastra")` are one song. Keying on title plus lead
    credit collapses them.
    """
    artists = _song_artists(song)
    lead = artists[0]["id"] if artists else _normalize_title((song.get("album") or {}).get("name"))
    return f"{_normalize_title(song.get('name'))}|{lead}"


def _artist_ids(song_or_entry: dict, from_history: bool = False) -> set:
    if from_history:
        return {a["id"] for a in (song_or_entry.get("artists") or []) if a and a.get("id")}
    return {a["id"] for a in _song_artists(song_or_entry)}


def _is_alternate_version(song: dict) -> bool:
    name = (song.get("name") or "").lower()
    return any(marker in name for marker in VERSION_MARKERS)


def _primary_artist_name(song: dict) -> str:
    artists = _song_artists(song)
    if artists:
        return artists[0]["name"]
    return (song.get("subtitle") or "").split(" - ")[0].strip()


def build_profile(history: Optional[Iterable[dict]] = None) -> dict:
    """Collapse a listening log into a taste profile.

    Each history entry looks like:
        {"id", "name", "event", "at", "language", "year", "playCount",
         "artists": [{"id", "name"}], "album": {"id", "name"}}
    Only `id` is strictly required; everything else sharpens the profile.
    """
    history = list(history or [])
    now = _now_ms()

    artists: Dict[str, float] = defaultdict(float)
    artist_names: Dict[str, str] = {}
    languages: Dict[str, float] = defaultdict(float)
    year_weight_sum = 0.0
    year_value_sum = 0.0
    pop_weight_sum = 0.0
    pop_value_sum = 0.0

    heard: set = set()
    heard_titles: Dict[str, set] = {}
    disliked: set = set()
    skipped_artists: Dict[str, float] = defaultdict(float)
    track_scores: Dict[str, float] = defaultdict(float)
    track_meta: Dict[str, dict] = {}
    positive_weight = 0.0

    for entry in history:
        if not isinstance(entry, dict):
            continue
        song_id = entry.get("id")
        if not song_id:
            continue
        event = (entry.get("event") or "play").lower()
        base = EVENT_WEIGHTS.get(event, 1.0)
        decay = _decay(entry.get("at"), now)
        weight = base * decay

        heard.add(song_id)
        title = _normalize_title(entry.get("name"))
        if title:
            # Same composition can carry a different id and a different lead
            # credit, so remember the title with every artist tied to it and
            # treat an overlap as "already heard".
            heard_titles.setdefault(title, set()).update(_artist_ids(entry, from_history=True))
        if event == "dislike":
            disliked.add(song_id)

        entry_artists = [a for a in (entry.get("artists") or []) if a and a.get("id")]
        for artist in entry_artists:
            artist_names.setdefault(artist["id"], artist.get("name") or "")

        if weight < 0:
            for artist in entry_artists:
                skipped_artists[artist["id"]] += -weight
            continue

        positive_weight += weight
        track_scores[song_id] += weight
        if song_id not in track_meta:
            track_meta[song_id] = {
                "id": song_id,
                "name": entry.get("name") or "",
                "artist": (entry_artists[0]["name"] if entry_artists else ""),
                "artistId": (entry_artists[0]["id"] if entry_artists else None),
                "albumId": (entry.get("album") or {}).get("id"),
                "albumName": (entry.get("album") or {}).get("name"),
                "language": (entry.get("language") or "").lower() or None,
            }

        share = weight / max(1, len(entry_artists)) if entry_artists else 0.0
        for artist in entry_artists:
            artists[artist["id"]] += share

        language = (entry.get("language") or "").lower()
        if language:
            languages[language] += weight

        year = _to_year(entry.get("year"))
        if year:
            year_weight_sum += weight
            year_value_sum += weight * year

        if entry.get("playCount"):
            pop_weight_sum += weight
            pop_value_sum += weight * _norm_popularity(entry.get("playCount"))

    # Net out artists the listener actively skips.
    for artist_id, penalty in skipped_artists.items():
        if artist_id in artists:
            artists[artist_id] = max(0.0, artists[artist_id] - penalty * 0.6)

    top_artists = sorted(
        ((aid, w) for aid, w in artists.items() if w > 0), key=lambda kv: -kv[1]
    )
    top_languages = sorted(languages.items(), key=lambda kv: -kv[1])
    seeds = [
        track_meta[tid]
        for tid, _ in sorted(track_scores.items(), key=lambda kv: -kv[1])
        if tid in track_meta
    ]

    era_center = (year_value_sum / year_weight_sum) if year_weight_sum else None
    mainstream = (pop_value_sum / pop_weight_sum) if pop_weight_sum else 0.62

    return {
        "artists": dict(top_artists),
        "artistNames": artist_names,
        "topArtists": [
            {"id": aid, "name": artist_names.get(aid, ""), "weight": round(w, 4)}
            for aid, w in top_artists[:12]
        ],
        "maxArtistWeight": top_artists[0][1] if top_artists else 0.0,
        "languages": dict(top_languages),
        "topLanguages": [lang for lang, _ in top_languages[:4]] or list(DEFAULT_LANGUAGES),
        "maxLanguageWeight": top_languages[0][1] if top_languages else 0.0,
        "eraCenter": era_center,
        "mainstream": round(mainstream, 4),
        "seeds": seeds[:12],
        "heard": heard,
        "heardTitles": heard_titles,
        "disliked": disliked,
        "skippedArtists": dict(skipped_artists),
        "strength": round(_clamp(positive_weight / 25.0), 4),
        "events": len(history),
        "coldStart": positive_weight < 1.0,
    }


# ---------------------------------------------------------------------------
# Stage 2: candidate generation
# ---------------------------------------------------------------------------

class CandidatePool:
    """Songs keyed by id, each accumulating the recall sources that found it."""

    def __init__(self):
        self.songs: Dict[str, dict] = {}
        self.sources: Dict[str, Dict[str, dict]] = defaultdict(dict)
        # artist_id -> 0..1 similarity to the listener's taste, learned from
        # co-occurrence inside the curated playlists we pulled.
        self.neighbors: Dict[str, float] = {}
        self.neighbor_names: Dict[str, str] = {}

    def add(self, song: dict, source: str, strength: float, via: Optional[str] = None):
        song_id = (song or {}).get("id")
        if not song_id or not song.get("downloadUrl"):
            return
        self.songs.setdefault(song_id, song)
        existing = self.sources[song_id].get(source)
        if existing and existing["strength"] >= strength:
            existing["hits"] = existing.get("hits", 1) + 1
            return
        self.sources[song_id][source] = {
            "strength": float(strength),
            "via": via,
            "hits": (existing or {}).get("hits", 0) + 1,
        }

    def add_many(self, songs: Iterable[dict], source: str, strength: float,
                 via: Optional[str] = None, decay: float = 0.0):
        """`decay` linearly discounts later items, matching upstream rank order."""
        songs = list(songs or [])
        for index, song in enumerate(songs):
            factor = 1.0 - (decay * index / max(1, len(songs)))
            self.add(song, source, strength * max(0.25, factor), via)

    def __len__(self):
        return len(self.songs)


def _recall_from_artists(pool: CandidatePool, profile: dict, budget: int) -> None:
    top = profile["topArtists"][:budget]
    if not top:
        return
    max_weight = profile["maxArtistWeight"] or 1.0
    results = catalog.parallel([
        (lambda aid=a["id"]: catalog.artist_top_songs(aid, limit=14)) for a in top
    ])
    for artist, songs in zip(top, results):
        strength = _clamp(artist["weight"] / max_weight)
        pool.add_many(songs or [], "artist", 0.55 + 0.45 * strength,
                      via=artist["name"], decay=0.35)


def _recall_collaborative(pool: CandidatePool, profile: dict, budget: int) -> None:
    """Item-item collaborative filtering over editorial playlists.

    Curated playlists act as the "users" of a classic CF matrix: two songs that
    keep showing up in the same human curated playlists are genuinely related,
    which is a much better signal than string similarity on titles.
    """
    queries = []
    for seed in profile["seeds"][:4]:
        label = " ".join(x for x in (seed.get("name"), seed.get("artist")) if x).strip()
        if label:
            queries.append((label, seed.get("name") or seed.get("artist")))
    for artist in profile["topArtists"][:3]:
        if artist["name"]:
            queries.append((artist["name"], artist["name"]))
    if not queries:
        return

    searches = catalog.parallel([
        (lambda q=q: catalog.search_playlist_cards(q, limit=3)) for q, _ in queries
    ])

    playlist_via: Dict[str, str] = {}
    for (_, via), cards in zip(queries, searches):
        for card in cards or []:
            if card.get("id") and card["id"] not in playlist_via:
                playlist_via[card["id"]] = via or ""
    playlist_ids = list(playlist_via)[:budget]
    if not playlist_ids:
        return

    fetched = catalog.parallel([
        (lambda pid=pid: catalog.playlist_songs(pid, limit=40)) for pid in playlist_ids
    ], workers=10)

    # Co-occurrence count: how many distinct curated playlists hold this song.
    occurrences: Dict[str, int] = defaultdict(int)
    first_via: Dict[str, str] = {}
    songs_by_id: Dict[str, dict] = {}
    for pid, songs in zip(playlist_ids, fetched):
        for song in songs or []:
            sid = song.get("id")
            if not sid:
                continue
            occurrences[sid] += 1
            songs_by_id.setdefault(sid, song)
            first_via.setdefault(sid, playlist_via.get(pid, ""))

    # Second order signal, and the important one: the artists who keep showing
    # up inside playlists built around the listener's taste ARE that taste's
    # neighbourhood. The upstream "similar artists" field is always empty, so we
    # derive it ourselves.
    artist_tracks: Dict[str, int] = defaultdict(int)
    for songs in fetched:
        for song in songs or []:
            for artist in _song_artists(song):
                artist_tracks[artist["id"]] += 1
                pool.neighbor_names.setdefault(artist["id"], artist["name"])
    if artist_tracks:
        peak_artist = max(artist_tracks.values())
        for aid, count in artist_tracks.items():
            pool.neighbors[aid] = _clamp(math.log1p(count) / math.log1p(peak_artist))

    if not occurrences:
        return
    peak = max(occurrences.values())
    for sid, count in occurrences.items():
        # Log scale, floored: appearing in even one playlist curated around a
        # seed is meaningful, while 6 appearances should not be 6x 1 appearance.
        if peak > 1:
            strength = 0.45 + 0.55 * (math.log1p(count - 1) / math.log1p(peak - 1))
        else:
            strength = 0.55
        pool.add(songs_by_id[sid], "collab", _clamp(strength), via=first_via.get(sid))


def _recall_similar_artists(pool: CandidatePool, profile: dict, budget: int = 5) -> None:
    """Pull the catalogue of the neighbourhood artists found by the CF stage.

    Without this, a station seeded from one song runs dry the moment the
    per-artist cap is hit and falls back to generic trending.
    """
    known = set(profile["artists"])
    ranked = sorted(
        ((aid, sim) for aid, sim in pool.neighbors.items()
         if aid not in known and sim >= 0.2),
        key=lambda kv: -kv[1],
    )[:budget]
    if not ranked:
        return
    results = catalog.parallel([
        (lambda aid=aid: catalog.artist_top_songs(aid, limit=8)) for aid, _ in ranked
    ])
    for (aid, sim), songs in zip(ranked, results):
        pool.add_many(songs or [], "similar", 0.5 + 0.5 * sim,
                      via=pool.neighbor_names.get(aid), decay=0.3)


def _recall_from_albums(pool: CandidatePool, profile: dict, budget: int) -> None:
    album_ids, via = [], {}
    for seed in profile["seeds"]:
        aid = seed.get("albumId")
        if aid and aid not in via:
            via[aid] = seed.get("albumName") or seed.get("name") or ""
            album_ids.append(aid)
        if len(album_ids) >= budget:
            break
    if not album_ids:
        return
    albums = catalog.parallel([(lambda aid=aid: catalog.album(aid)) for aid in album_ids])
    for aid, built in zip(album_ids, albums):
        if not built:
            continue
        pool.add_many(built.get("songs") or [], "album", 0.6, via=via.get(aid), decay=0.2)


def _recall_trending(pool: CandidatePool, profile: dict, languages: List[str]) -> None:
    langs = languages[:3] or list(DEFAULT_LANGUAGES)
    max_weight = profile["maxLanguageWeight"] or 1.0
    results = catalog.parallel([
        (lambda lang=lang: catalog.trending(lang)) for lang in langs
    ])
    for lang, songs in zip(langs, results):
        share = _clamp((profile["languages"].get(lang, 0.0) / max_weight) if max_weight else 0.6)
        pool.add_many(songs or [], "trend", 0.45 + 0.4 * share, via=lang.title(), decay=0.4)


def _recall_fresh(pool: CandidatePool, languages: List[str]) -> None:
    langs = languages[:2] or ["hindi"]
    results = catalog.parallel([
        (lambda lang=lang: catalog.new_release_songs(lang, limit=25)) for lang in langs
    ])
    for lang, songs in zip(langs, results):
        pool.add_many(songs or [], "fresh", 0.7, via=lang.title(), decay=0.3)


def _recall_mood(pool: CandidatePool, mood_id: str) -> None:
    mood = catalog.MOOD_BY_ID.get(mood_id)
    if not mood:
        return
    pool.add_many(catalog.mood_songs(mood_id, limit=40), "mood", 0.95,
                  via=mood["name"], decay=0.3)


def generate_candidates(profile: dict, mood: Optional[str] = None,
                        wide: bool = True) -> CandidatePool:
    pool = CandidatePool()
    languages = profile["topLanguages"] or list(DEFAULT_LANGUAGES)

    if mood:
        _recall_mood(pool, mood)

    if profile["coldStart"]:
        # Nothing to personalise from: lean on what the world is playing.
        _recall_trending(pool, profile, list(DEFAULT_LANGUAGES))
        _recall_fresh(pool, list(DEFAULT_LANGUAGES))
        chart_cards = catalog.charts(limit=3)
        chart_songs = catalog.parallel([
            (lambda cid=c["id"]: catalog.playlist_songs(cid, limit=30)) for c in chart_cards if c.get("id")
        ])
        for card, songs in zip(chart_cards, chart_songs):
            pool.add_many(songs or [], "chart", 0.6, via=card.get("name"), decay=0.3)
        return pool

    _recall_from_artists(pool, profile, budget=6 if wide else 3)
    _recall_collaborative(pool, profile, budget=12 if wide else 6)
    # Depends on the neighbourhood the CF stage just learned, so it runs after.
    _recall_similar_artists(pool, profile, budget=6 if wide else 3)
    if wide:
        _recall_from_albums(pool, profile, budget=3)
    _recall_trending(pool, profile, languages)
    _recall_fresh(pool, languages)
    return pool


# ---------------------------------------------------------------------------
# Stage 3: scoring
# ---------------------------------------------------------------------------

def _jitter(song_id: str, salt: str) -> float:
    """Deterministic per request wobble so refreshes reshuffle sensibly."""
    digest = hashlib.md5(f"{song_id}:{salt}".encode()).digest()
    return digest[0] / 255.0


def score_candidates(pool: CandidatePool, profile: dict, salt: str = "",
                     allow_heard: bool = False,
                     exclude: Optional[set] = None,
                     weights: Optional[Dict[str, float]] = None) -> List[dict]:
    weights = weights or WEIGHTS
    exclude = exclude or set()
    max_artist = profile["maxArtistWeight"] or 1.0
    max_language = profile["maxLanguageWeight"] or 1.0
    era_center = profile["eraCenter"]
    mainstream = profile["mainstream"]
    this_year = time.gmtime().tm_year

    scored = []
    for song_id, song in pool.songs.items():
        if song_id in exclude or song_id in profile["disliked"]:
            continue
        sources = pool.sources[song_id]
        artists = _song_artists(song)

        title_key = _title_key(song)
        heard = song_id in profile["heard"]
        if not heard:
            known_artists = profile["heardTitles"].get(_normalize_title(song.get("name")))
            if known_artists is not None:
                candidate_artists = {a["id"] for a in artists}
                # No artist data on either side: fall back to the title alone.
                heard = bool(candidate_artists & known_artists) or not candidate_artists
        if heard and not allow_heard:
            continue

        # --- artist affinity -------------------------------------------------
        # Direct affinity (you play this artist) plus a discounted neighbourhood
        # affinity (you play artists who share playlists with this one).
        artist_affinity = 0.0
        artist_via = ""
        neighbor_affinity = 0.0
        for artist in artists:
            weight = profile["artists"].get(artist["id"], 0.0)
            if weight > artist_affinity:
                artist_affinity = weight
                artist_via = artist["name"]
            neighbor_affinity = max(neighbor_affinity, pool.neighbors.get(artist["id"], 0.0))
        direct_signal = _clamp(artist_affinity / max_artist) if max_artist else 0.0
        artist_signal = max(direct_signal, 0.75 * neighbor_affinity)

        # --- collaborative filtering ----------------------------------------
        collab = sources.get("collab")
        collab_signal = collab["strength"] if collab else 0.0

        # --- language --------------------------------------------------------
        language = (song.get("language") or "").lower()
        language_signal = _clamp(profile["languages"].get(language, 0.0) / max_language) if max_language else 0.5

        # --- era -------------------------------------------------------------
        year = _to_year(song.get("year")) or _to_year(song.get("releaseDate"))
        if era_center and year:
            era_signal = math.exp(-abs(year - era_center) / 9.0)
        else:
            era_signal = 0.5

        # --- popularity fit --------------------------------------------------
        popularity_signal = 1.0 - abs(_norm_popularity(song.get("playCount")) - mainstream)

        # --- freshness -------------------------------------------------------
        if year:
            freshness_signal = _clamp(1.0 - (this_year - year) / 6.0)
        else:
            freshness_signal = 0.3

        # --- recall prior ----------------------------------------------------
        recall_signal = 0.0
        for name, meta in sources.items():
            prior = SOURCE_PRIOR.get(name, 0.5) * meta["strength"]
            recall_signal = max(recall_signal, prior)
        # Corroboration bonus: found by more than one independent source.
        if len(sources) > 1:
            recall_signal = _clamp(recall_signal + 0.06 * (len(sources) - 1))

        signals = {
            "artist": round(artist_signal, 4),
            "collab": round(collab_signal, 4),
            "language": round(language_signal, 4),
            "era": round(era_signal, 4),
            "popularity": round(_clamp(popularity_signal), 4),
            "freshness": round(freshness_signal, 4),
            "recall": round(_clamp(recall_signal), 4),
        }
        score = sum(weights.get(k, 0.0) * signals[k] for k in signals)

        # Penalties.
        skip_penalty = max(
            (profile["skippedArtists"].get(a["id"], 0.0) for a in artists), default=0.0
        )
        if skip_penalty:
            score *= _clamp(1.0 - 0.3 * skip_penalty, 0.25, 1.0)
        if heard:
            score *= 0.3  # already known: keep it, bury it
        if _is_alternate_version(song):
            score *= 0.6  # lofi flips and remixes sit behind the original
        if song.get("explicitContent"):
            score *= 0.97

        score = score * 0.9 + 0.1 * _jitter(song_id, salt)

        scored.append({
            "song": song,
            "score": round(score, 5),
            "titleKey": title_key,
            "signals": signals,
            "sources": {k: {"strength": round(v["strength"], 3), "via": v["via"]}
                        for k, v in sources.items()},
            "heard": heard,
            "artistIds": [a["id"] for a in artists],
            "artistVia": artist_via,
            # Discovery is about the listener's own history, not the derived
            # neighbourhood, so exploration slots stay genuinely exploratory.
            "isDiscovery": direct_signal < 0.05,
            "directArtist": round(direct_signal, 4),
            "weights": weights,
        })

    scored.sort(key=lambda c: -c["score"])
    return scored


# ---------------------------------------------------------------------------
# Stage 4: diversity aware re-ranking
# ---------------------------------------------------------------------------

def _reason(candidate: dict, profile: dict, seed_label: Optional[str] = None) -> str:
    signals = candidate["signals"]
    sources = candidate["sources"]
    song = candidate["song"]

    weights = candidate.get("weights") or WEIGHTS
    contributions = {k: weights.get(k, 0.0) * signals[k] for k in signals}
    ranked = sorted(contributions.items(), key=lambda kv: -kv[1])
    top = ranked[0][0]

    # A mood shelf should explain itself as a mood, whatever the maths says.
    if "mood" in sources and sources["mood"].get("via"):
        return f"{sources['mood']['via']} pick for you"
    if seed_label and top in ("artist", "collab"):
        return f"Because you played {seed_label}"
    if candidate.get("directArtist", 1.0) < 0.05 and (
        "similar" in sources or top == "artist"
    ):
        # Surfaced by the derived neighbourhood rather than by direct history.
        top_artist = (profile["topArtists"] or [{}])[0].get("name")
        if top_artist:
            return f"Similar to {top_artist}"
        anchor = sources.get("similar", {}).get("via") or candidate["artistVia"]
        if anchor:
            return f"In the same lane as {anchor}"
    if top == "artist" and candidate["artistVia"]:
        return f"Because you listen to {candidate['artistVia']}"
    if top == "collab" and sources.get("collab", {}).get("via"):
        return f"Plays well with {sources['collab']['via']}"
    if top == "freshness" or "fresh" in sources:
        return f"New release in {(song.get('language') or 'music').title()}"
    if "album" in sources and sources["album"].get("via"):
        return f"From the album {sources['album']['via']}"
    if "chart" in sources and sources["chart"].get("via"):
        return f"Charting on {sources['chart']['via']}"
    if "trend" in sources:
        return f"Trending in {(song.get('language') or 'music').title()}"
    if top == "language":
        return f"More {(song.get('language') or 'music').title()} for you"
    if top == "era" and _to_year(song.get("year")):
        return f"From your {_to_year(song.get('year'))} era"
    if candidate["isDiscovery"]:
        return "Fresh discovery"
    return "Picked for you"


def rerank(scored: List[dict], profile: dict, limit: int = 30,
           explore: bool = True, max_per_artist: int = MAX_PER_ARTIST,
           max_per_album: int = MAX_PER_ALBUM) -> List[dict]:
    """Greedy MMR style selection: relevance discounted by redundancy."""
    # Collapse alternate cuts of the same composition before ranking, keeping
    # the highest scoring one.
    remaining, seen_titles = [], set()
    for candidate in scored:
        key = candidate.get("titleKey")
        if key and key in seen_titles:
            continue
        if key:
            seen_titles.add(key)
        remaining.append(candidate)

    selected: List[dict] = []
    artist_counts: Dict[str, int] = defaultdict(int)
    album_counts: Dict[str, int] = defaultdict(int)
    language_counts: Dict[str, int] = defaultdict(int)

    while remaining and len(selected) < limit:
        slot = len(selected)
        want_discovery = explore and slot > 0 and slot % EXPLORE_EVERY == 0

        best_index, best_value = None, -1.0
        for index, candidate in enumerate(remaining):
            song = candidate["song"]
            album_id = (song.get("album") or {}).get("id")
            language = (song.get("language") or "").lower()

            # Hard caps keep a single artist or album from eating the feed.
            if any(artist_counts[aid] >= max_per_artist for aid in candidate["artistIds"]):
                continue
            if album_id and album_counts[album_id] >= max_per_album:
                continue

            redundancy = 1.0
            for aid in candidate["artistIds"]:
                redundancy *= ARTIST_PENALTY ** artist_counts[aid]
            if album_id:
                redundancy *= ALBUM_PENALTY ** album_counts[album_id]
            language_run = max(0, language_counts[language] - LANGUAGE_PENALTY_AFTER)
            redundancy *= LANGUAGE_PENALTY ** language_run

            value = candidate["score"] * redundancy
            if want_discovery and candidate["isDiscovery"]:
                value *= 1.6  # bias, not a guarantee
            if value > best_value:
                best_value, best_index = value, index

        if best_index is None:
            # Every remaining candidate is capped out. Relax and take the best.
            best_index = 0

        candidate = remaining.pop(best_index)
        song = candidate["song"]
        for aid in candidate["artistIds"]:
            artist_counts[aid] += 1
        album_id = (song.get("album") or {}).get("id")
        if album_id:
            album_counts[album_id] += 1
        language_counts[(song.get("language") or "").lower()] += 1

        selected.append(candidate)

    return selected


def _present(candidate: dict, profile: dict, rank: int,
             seed_label: Optional[str] = None) -> dict:
    song = dict(candidate["song"])
    song["recommendation"] = {
        "rank": rank,
        "score": candidate["score"],
        "reason": _reason(candidate, profile, seed_label=seed_label),
        "signals": candidate["signals"],
        "sources": sorted(candidate["sources"].keys()),
        "discovery": candidate["isDiscovery"],
        "familiar": candidate["heard"],
    }
    return song


# ---------------------------------------------------------------------------
# Public entry points
# ---------------------------------------------------------------------------

def recommend(history: Optional[List[dict]] = None, limit: int = 30,
              mood: Optional[str] = None, exclude: Optional[Iterable[str]] = None,
              allow_heard: bool = False, salt: Optional[str] = None,
              wide: bool = True, weight_profile: str = "default",
              profile: Optional[dict] = None,
              pool: Optional[CandidatePool] = None) -> dict:
    """Main entry point. `profile` and `pool` can be passed in to let several
    shelves share one expensive candidate generation pass."""
    weights = WEIGHT_PROFILES.get(weight_profile, WEIGHTS)
    if profile is None:
        profile = build_profile(history)
    if pool is None:
        pool = generate_candidates(profile, mood=mood, wide=wide)
    salt = salt or str(int(time.time() // 900))  # reshuffles every 15 minutes

    scored = score_candidates(pool, profile, salt=salt, allow_heard=allow_heard,
                              exclude=set(exclude or ()), weights=weights)
    if not scored and not allow_heard:
        # Everything in the pool was already heard. Better to repeat than to
        # hand back an empty feed.
        scored = score_candidates(pool, profile, salt=salt, allow_heard=True,
                                  exclude=set(exclude or ()), weights=weights)
    picked = rerank(scored, profile, limit=limit)
    items = [_present(c, profile, i + 1) for i, c in enumerate(picked)]

    return {
        "items": items,
        "meta": {
            "candidates": len(pool),
            "scored": len(scored),
            "returned": len(items),
            "coldStart": profile["coldStart"],
            "profileStrength": profile["strength"],
            "events": profile["events"],
            "topArtists": profile["topArtists"][:5],
            "topLanguages": profile["topLanguages"],
            "eraCenter": round(profile["eraCenter"]) if profile["eraCenter"] else None,
            "mainstream": profile["mainstream"],
            "discoveryShare": round(
                sum(1 for i in items if i["recommendation"]["discovery"]) / max(1, len(items)), 3
            ),
            "weightProfile": weight_profile,
            "weights": weights,
        },
    }


def _profile_from_songs(songs: List[dict], event: str = "like") -> dict:
    now = _now_ms()
    history = []
    for song in songs:
        history.append({
            "id": song.get("id"),
            "name": song.get("name"),
            "event": event,
            "at": now,
            "language": song.get("language"),
            "year": song.get("year"),
            "playCount": song.get("playCount"),
            "artists": _song_artists(song),
            "album": song.get("album"),
        })
    return build_profile(history)


def radio(seed_song_id: str, limit: int = 40) -> dict:
    """An endless queue seeded from a single track."""
    seed = catalog.song_by_id(seed_song_id)
    if not seed:
        return {"items": [], "seed": None, "meta": {"error": "song not found"}}

    profile = _profile_from_songs([seed])
    pool = generate_candidates(profile, wide=True)
    # The seed's own album siblings are especially relevant for a radio.
    album_id = (seed.get("album") or {}).get("id")
    if album_id:
        built = catalog.album(album_id)
        if built:
            pool.add_many(built.get("songs") or [], "album", 0.65,
                          via=built.get("name"), decay=0.2)

    scored = score_candidates(pool, profile, salt=seed_song_id, allow_heard=False,
                              exclude={seed_song_id}, weights=WEIGHT_PROFILES["radio"])
    picked = rerank(scored, profile, limit=limit, max_per_artist=3)
    label = seed.get("name")
    items = [_present(c, profile, i + 1, seed_label=label) for i, c in enumerate(picked)]
    return {
        "seed": seed,
        "items": items,
        "meta": {"candidates": len(pool), "returned": len(items),
                 "seedName": label},
    }


def artist_radio(artist_id: str, limit: int = 40) -> dict:
    top = catalog.artist_top_songs(artist_id, limit=12)
    if not top:
        return {"items": [], "meta": {"error": "artist not found"}}
    profile = _profile_from_songs(top[:6])
    pool = generate_candidates(profile, wide=True)
    pool.add_many(top, "artist", 0.95, via=_primary_artist_name(top[0]), decay=0.2)
    scored = score_candidates(pool, profile, salt=artist_id, allow_heard=True,
                              weights=WEIGHT_PROFILES["radio"])
    picked = rerank(scored, profile, limit=limit, max_per_artist=3)
    return {
        "items": [_present(c, profile, i + 1) for i, c in enumerate(picked)],
        "meta": {"candidates": len(pool), "artist": _primary_artist_name(top[0])},
    }


def similar_to_songs(songs: List[dict], limit: int = 20,
                     exclude: Optional[Iterable[str]] = None) -> List[dict]:
    """Used for "more like this" strips on album and playlist pages."""
    if not songs:
        return []
    profile = _profile_from_songs(songs[:8])
    pool = generate_candidates(profile, wide=False)
    skip = set(exclude or ()) | {s.get("id") for s in songs}
    scored = score_candidates(pool, profile, salt=str(songs[0].get("id")),
                              allow_heard=True, exclude=skip,
                              weights=WEIGHT_PROFILES["radio"])
    picked = rerank(scored, profile, limit=limit, max_per_artist=3)
    return [_present(c, profile, i + 1) for i, c in enumerate(picked)]
