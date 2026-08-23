"""
catalog.py  |  MusicArea

A normalized read layer over the JioSaavn endpoints. Everything above this file
(the recommender, the HTTP routes) works with clean dicts and never has to think
about the upstream payload quirks.

Every function here is cached and fails soft: on an upstream hiccup you get an
empty list instead of an exception, so one bad call can never blank out a feed.
"""

from concurrent.futures import ThreadPoolExecutor
from typing import Iterable, List, Optional

from helpers import clean_text, create_image_links, jiosaavn_fetch_cached  # noqa: F401
from models import build_album, build_artist, build_playlist, build_song

# Cache lifetimes, in seconds. Editorial content moves slowly, search results
# and trending move faster.
TTL_STATIC = 60 * 60 * 6
TTL_BROWSE = 60 * 60
TTL_TRENDING = 60 * 20
TTL_SEARCH = 60 * 30

LANGUAGES = [
    "hindi", "english", "punjabi", "tamil", "telugu",
    "marathi", "bengali", "kannada", "malayalam", "gujarati",
    "bhojpuri", "urdu", "haryanvi", "rajasthani", "assamese", "odia",
]

# Mood and genre seeds used for the browse shelves and for the exploration arm
# of the recommender.
# `query` is the broad search. `keyword` is a single word that survives being
# combined with a language ("punjabi party"), which the upstream literal search
# needs: "party anthems punjabi" matches nothing at all.
MOODS = [
    {"id": "romance",  "name": "Romance",    "query": "romantic hits",       "keyword": "romantic",     "hue": 336},
    {"id": "party",    "name": "Party",      "query": "party anthems",       "keyword": "party",        "hue": 24},
    {"id": "chill",    "name": "Chill",      "query": "chill lofi",          "keyword": "chill",        "hue": 190},
    {"id": "sad",      "name": "Heartbreak", "query": "sad songs",           "keyword": "sad",          "hue": 220},
    {"id": "workout",  "name": "Workout",    "query": "workout pump",        "keyword": "workout",      "hue": 8},
    {"id": "devotion", "name": "Devotional", "query": "bhakti devotional",   "keyword": "bhakti",       "hue": 44},
    {"id": "retro",    "name": "Retro Gold", "query": "90s bollywood retro", "keyword": "retro",        "hue": 268},
    {"id": "indie",    "name": "Indie",      "query": "indie india",         "keyword": "indie",        "hue": 158},
    {"id": "sufi",     "name": "Sufi",       "query": "sufi qawwali",        "keyword": "sufi",         "hue": 292},
    {"id": "focus",    "name": "Focus",      "query": "instrumental focus",  "keyword": "instrumental", "hue": 210},
]

MOOD_BY_ID = {m["id"]: m for m in MOODS}


# ---------------------------------------------------------------------------
# Small utilities
# ---------------------------------------------------------------------------

def _as_items(payload) -> list:
    """Upstream browse endpoints return either a bare list or {"data": [...]}"""
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict):
        for key in ("data", "results", "list", "songs", "albums", "playlists"):
            value = payload.get(key)
            if isinstance(value, list):
                return value
    return []


def _playable(song: dict) -> bool:
    """Drop entries we could not resolve a stream for."""
    return bool(song and song.get("id") and song.get("downloadUrl"))


def dedupe_songs(songs: Iterable[dict]) -> List[dict]:
    seen = set()
    out = []
    for song in songs:
        sid = (song or {}).get("id")
        if not sid or sid in seen:
            continue
        seen.add(sid)
        out.append(song)
    return out


def build_card(item: dict) -> dict:
    """Lightweight shape for grid and shelf tiles (album, playlist, artist, song)."""
    item = item or {}
    more = item.get("more_info") or {}
    kind = item.get("type") or "album"
    subtitle = clean_text(item.get("subtitle")) or ""
    if not subtitle:
        if kind == "playlist" and more.get("song_count"):
            subtitle = f"{more['song_count']} songs"
        elif more.get("music"):
            subtitle = clean_text(more["music"])
        # `firstname` is the upstream curator name, which is the provider's own
        # brand on every editorial playlist. Showing it put "JioSaavn" under
        # every chart tile, so fall back to the track count instead.
        elif str(more.get("song_count", "")).isdigit():
            subtitle = f"{more['song_count']} songs"
        else:
            subtitle = "Editorial playlist" if kind == "playlist" else ""

    return {
        "id": item.get("id"),
        "name": clean_text(item.get("title")) or clean_text(item.get("name")),
        "subtitle": subtitle,
        "type": kind,
        "image": create_image_links(item.get("image") or ""),
        "language": item.get("language") or more.get("language"),
        "year": item.get("year") or None,
        "songCount": int(more["song_count"]) if str(more.get("song_count", "")).isdigit() else None,
    }


def parallel(jobs: list, workers: int = 8) -> list:
    """Run zero-arg callables concurrently, preserving order, swallowing errors."""
    if not jobs:
        return []
    results = [None] * len(jobs)
    with ThreadPoolExecutor(max_workers=min(workers, len(jobs))) as pool:
        futures = {pool.submit(job): i for i, job in enumerate(jobs)}
        for future, index in futures.items():
            try:
                results[index] = future.result(timeout=20)
            except Exception:
                results[index] = None
    return results


# ---------------------------------------------------------------------------
# Entity lookups
# ---------------------------------------------------------------------------

def songs_by_ids(ids: Iterable[str]) -> List[dict]:
    ids = [str(i) for i in ids if i]
    if not ids:
        return []
    out = []
    # The upstream endpoint gets unhappy with very long id lists.
    for start in range(0, len(ids), 25):
        chunk = ids[start:start + 25]
        data = jiosaavn_fetch_cached("song.getDetails", {"pids": ",".join(chunk)}, ttl=TTL_STATIC)
        out.extend(build_song(s) for s in (data.get("songs") or []))
    return [s for s in out if _playable(s)]


def song_by_id(song_id: str) -> Optional[dict]:
    found = songs_by_ids([song_id])
    return found[0] if found else None


def album(album_id: str, fresh: bool = False) -> Optional[dict]:
    data = jiosaavn_fetch_cached(
        "content.getAlbumDetails", {"albumid": album_id}, ttl=TTL_STATIC, fresh=fresh
    )
    if not data or not data.get("id"):
        return None
    built = build_album(data)
    built["songs"] = [s for s in (built.get("songs") or []) if _playable(s)]
    return built


def playlist(playlist_id: str, limit: int = 100) -> Optional[dict]:
    data = jiosaavn_fetch_cached(
        "playlist.getDetails", {"listid": playlist_id, "n": limit, "p": 0}, ttl=TTL_BROWSE
    )
    if not data or not data.get("id"):
        return None
    built = build_playlist(data)
    built["songs"] = [s for s in (built.get("songs") or []) if _playable(s)][:limit]
    built["songCount"] = len(built["songs"])
    return built


def playlist_song_ids(playlist_id: str, limit: int = 60) -> List[str]:
    """Cheap variant used by the collaborative-filtering stage."""
    data = jiosaavn_fetch_cached(
        "playlist.getDetails", {"listid": playlist_id, "n": limit, "p": 0}, ttl=TTL_BROWSE
    )
    return [s.get("id") for s in (data.get("list") or []) if s.get("id")]


def playlist_songs(playlist_id: str, limit: int = 60) -> List[dict]:
    data = jiosaavn_fetch_cached(
        "playlist.getDetails", {"listid": playlist_id, "n": limit, "p": 0}, ttl=TTL_BROWSE
    )
    songs = [build_song(s) for s in (data.get("list") or [])]
    return [s for s in songs if _playable(s)][:limit]


def artist(artist_id: str, song_count: int = 20, album_count: int = 12) -> Optional[dict]:
    data = jiosaavn_fetch_cached(
        "artist.getArtistPageDetails",
        {
            "artistId": artist_id, "n_song": song_count, "n_album": album_count,
            "page": 0, "sort_order": "desc", "category": "popularity",
        },
        ttl=TTL_BROWSE,
    )
    if not data or not (data.get("artistId") or data.get("id")):
        return None
    built = build_artist(data)
    built["topSongs"] = [s for s in (built.get("topSongs") or []) if _playable(s)]
    return built


def artist_top_songs(artist_id: str, limit: int = 20) -> List[dict]:
    data = jiosaavn_fetch_cached(
        "artist.getArtistMoreSong",
        {"artistId": artist_id, "page": 0, "sort_order": "desc", "category": "popularity"},
        ttl=TTL_BROWSE,
    )
    raw = ((data.get("topSongs") or {}).get("songs")) or []
    songs = [build_song(s) for s in raw]
    playable = [s for s in songs if _playable(s)]
    if playable:
        return playable[:limit]
    # Fall back to the artist page, which sometimes carries songs when the
    # dedicated endpoint comes back empty.
    profile = artist(artist_id, song_count=limit)
    return (profile or {}).get("topSongs") or []


def lyrics(lyrics_id: str) -> Optional[dict]:
    data = jiosaavn_fetch_cached("lyrics.getLyrics", {"lyrics_id": lyrics_id}, ttl=TTL_STATIC)
    body = (data or {}).get("lyrics")
    if not body:
        return None
    return {
        "lyrics": body,
        "copyright": (data.get("lyrics_copyright") or "").strip() or None,
        "snippet": data.get("snippet") or None,
    }


# ---------------------------------------------------------------------------
# Browse and discovery
# ---------------------------------------------------------------------------

def trending(language: str = "hindi", entity_type: str = "song") -> List[dict]:
    data = jiosaavn_fetch_cached(
        "content.getTrending",
        {"entity_type": entity_type, "entity_language": language},
        ttl=TTL_TRENDING,
    )
    items = _as_items(data)
    if entity_type == "song":
        return [s for s in (build_song(i) for i in items if i.get("type") == "song") if _playable(s)]
    return [build_card(i) for i in items]


def charts(language: Optional[str] = None, limit: int = 20) -> List[dict]:
    data = jiosaavn_fetch_cached("content.getCharts", {}, ttl=TTL_BROWSE)
    cards = [build_card(i) for i in _as_items(data)]
    if language:
        wanted = language.lower()
        cards = [c for c in cards if wanted in (c.get("name") or "").lower()] or cards
    return cards[:limit]


def new_releases(language: str = "hindi", limit: int = 20) -> List[dict]:
    """Albums only.

    The upstream endpoint mixes albums and standalone singles in one list. A
    single's id is a song id, so treating it as an album yields an empty page.
    Singles are served separately by new_release_songs().
    """
    data = jiosaavn_fetch_cached(
        "content.getAlbums", {"n": 50, "p": 1, "language": language}, ttl=TTL_TRENDING
    )
    albums = [i for i in _as_items(data) if i.get("type") == "album" and i.get("id")]
    return [build_card(i) for i in albums][:limit]


def new_release_songs(language: str = "hindi", limit: int = 20) -> List[dict]:
    """Fresh songs only, used as the novelty arm of the recommender."""
    data = jiosaavn_fetch_cached(
        "content.getAlbums", {"n": 40, "p": 1, "language": language}, ttl=TTL_TRENDING
    )
    songs = [build_song(i) for i in _as_items(data) if i.get("type") == "song"]
    return [s for s in songs if _playable(s)][:limit]


def featured_playlists(language: str = "hindi", limit: int = 20) -> List[dict]:
    data = jiosaavn_fetch_cached(
        "content.getFeaturedPlaylists", {"n": max(limit * 2, 30), "p": 1, "language": language},
        ttl=TTL_BROWSE,
    )
    playlists = [i for i in _as_items(data) if i.get("type") == "playlist" and i.get("id")]
    return [build_card(i) for i in playlists][:limit]


def search_songs(query: str, limit: int = 20, page: int = 0) -> List[dict]:
    if not query:
        return []
    data = jiosaavn_fetch_cached(
        "search.getResults", {"q": query, "p": page, "n": limit}, ttl=TTL_SEARCH
    )
    songs = [build_song(s) for s in (data.get("results") or [])]
    return [s for s in songs if _playable(s)][:limit]


def search_playlist_cards(query: str, limit: int = 10) -> List[dict]:
    if not query:
        return []
    data = jiosaavn_fetch_cached(
        "search.getPlaylistResults", {"q": query, "p": 0, "n": limit}, ttl=TTL_SEARCH
    )
    return [build_card(i) for i in _as_items(data)][:limit]


def search_album_cards(query: str, limit: int = 10) -> List[dict]:
    if not query:
        return []
    data = jiosaavn_fetch_cached(
        "search.getAlbumResults", {"q": query, "p": 0, "n": limit}, ttl=TTL_SEARCH
    )
    return [build_card(i) for i in _as_items(data)][:limit]


def search_artist_cards(query: str, limit: int = 10) -> List[dict]:
    if not query:
        return []
    data = jiosaavn_fetch_cached(
        "search.getArtistResults", {"q": query, "p": 0, "n": limit}, ttl=TTL_SEARCH
    )
    cards = []
    for item in _as_items(data):
        cards.append({
            "id": item.get("id"),
            "name": clean_text(item.get("name") or item.get("title")),
            "subtitle": clean_text(item.get("description") or item.get("role") or "Artist"),
            "type": "artist",
            "image": create_image_links(item.get("image") or ""),
            })
    return cards[:limit]


# Hues for the language tiles, so each one is recognisable by colour rather than
# only by its label.
LANGUAGE_HUES = {
    "hindi": 268, "english": 210, "punjabi": 24, "tamil": 158, "telugu": 190,
    "marathi": 336, "bengali": 44, "kannada": 292, "malayalam": 130, "gujarati": 8,
    "bhojpuri": 58, "urdu": 240, "haryanvi": 100, "rajasthani": 320,
    "assamese": 176, "odia": 12,
}


def language_cards(limit: int = 12) -> List[dict]:
    """Languages with artwork, drawn from what is currently trending in each.

    The browse and search screens used plain text chips, which gave a listener no
    reason to pick one over another.
    """
    langs = LANGUAGES[:limit]
    results = parallel([(lambda l=l: trending(l)) for l in langs], workers=10)
    cards = []
    for language, songs in zip(langs, results):
        covers = [s["image"] for s in (songs or []) if s.get("image")][:4]
        if not covers:
            continue
        cards.append({
            "id": language,
            "name": language.title(),
            "hue": LANGUAGE_HUES.get(language, 268),
            "image": covers[0],
            "covers": covers,
        })
    return cards


def mood_cards() -> List[dict]:
    """The mood list with real artwork attached, for the browse tiles.

    Each mood borrows the cover of the editorial playlist that best matches it,
    and carries a few track covers behind that as a fallback and for collages.
    Every lookup is individually cached, so this is cheap after the first call.
    """
    jobs = []
    for mood in MOODS:
        jobs.append(lambda q=mood["query"]: search_playlist_cards(q, limit=1))
        jobs.append(lambda q=mood["query"]: search_songs(q, limit=4))
    results = parallel(jobs, workers=10)

    cards = []
    for index, mood in enumerate(MOODS):
        playlists = results[index * 2] or []
        songs = results[index * 2 + 1] or []
        covers = [s["image"] for s in songs if s.get("image")][:4]
        # Album art in preference to the editorial playlist cover. Playlist
        # covers have their own title typeset into the artwork, which collided
        # with the mood label drawn over the tile: "Romance" sat on top of a
        # faint "Most Streamed Love Songs".
        image = None
        if covers:
            image = covers[0]
        elif playlists and playlists[0].get("image"):
            image = playlists[0]["image"]
        card = dict(mood)
        card["image"] = image
        card["covers"] = covers
        cards.append(card)
    return cards


def mood_songs(mood_id: str, limit: int = 30) -> List[dict]:
    mood = MOOD_BY_ID.get(mood_id)
    if not mood:
        return []
    return search_songs(mood["query"], limit=limit)


def mood_pool(mood_id: str, limit: int = 160,
              languages: Optional[List[str]] = None) -> List[dict]:
    """A wide pool for one mood, from search plus curated playlists.

    Search alone returns a few dozen tracks in a fixed order, which gives
    personalised ranking nothing to choose between. Two things widen it:

      * the mood's editorial playlists, and
      * the same mood query repeated per language the listener actually plays.

    The second matters more than it looks. A bare "party anthems" search skews
    heavily Hindi, so a Punjabi listener would be ranked against a pool that
    holds almost nothing they like. Asking for the mood in their language gives
    the ranking real material to work with.
    """
    mood = MOOD_BY_ID.get(mood_id)
    if not mood:
        return []

    keyword = mood.get("keyword") or mood["query"]
    langs = [l for l in (languages or [])[:2] if l]

    # Language first, because "punjabi party" matches while the reverse order
    # and the longer phrase both return nothing.
    song_queries = [mood["query"]] + [f"{lang} {keyword}" for lang in langs]
    playlist_queries = [mood["query"]] + [f"{lang} {keyword}" for lang in langs]

    jobs = [(lambda q=q: search_songs(q, limit=40)) for q in song_queries]
    for query in playlist_queries:
        for card in search_playlist_cards(query, limit=2):
            if card.get("id"):
                jobs.append(lambda pid=card["id"]: playlist_songs(pid, limit=40))

    gathered: List[dict] = []
    for result in parallel(jobs, workers=10):
        gathered.extend(result or [])
    return dedupe_songs(gathered)[:limit]
