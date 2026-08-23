"""
app.py  |  MusicArea

Flask application serving both the MusicArea web player and the JSON API it
runs on. The catalog read layer lives in catalog.py and the recommendation
engine in recommender.py.

Original JioSaavn API layer credits: @ab_devs
"""

import json
import re
from flask import Flask, jsonify, request, make_response, render_template, send_from_directory
from werkzeug.exceptions import HTTPException

import catalog
import recommender
from helpers import CACHE, jiosaavn_fetch
from models import (
    build_song,
    build_album,
    build_playlist,
    build_artist,
    build_search_all,
    build_search_songs,
    build_search_albums,
    build_search_artists,
    build_search_playlists,
)

app = Flask(__name__)


def _cors(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    return response

@app.after_request
def after_request(response):
    if request.path.startswith("/static/"):
        response.headers["Cache-Control"] = "public, max-age=3600"
    return _cors(response)

@app.before_request
def handle_options():
    if request.method == "OPTIONS":
        resp = make_response("", 204)
        return _cors(resp)


# ─── Helpers ──────────────────────────────────────────────────────────────────

def ok(data):
    return jsonify({"success": True, "data": data})

def err(msg, code=400):
    return jsonify({"success": False, "message": msg}), code


# ─── HOME ─────────────────────────────────────────────────────────────────────

@app.route("/")
def home():
    """The MusicArea player. Everything is client rendered from the API below."""
    return render_template("index.html")


@app.route("/api")
def api_index():
    return jsonify({
        "success": True,
        "app": "MusicArea",
        "endpoints": {
            "feed":        "POST /api/feed  (body: {history, mood, limit})",
            "browse":      "/api/browse",
            "radio":       "/api/radio/<song_id>",
            "artistRadio": "/api/artists/<artist_id>/radio",
            "mood":        "/api/moods/<mood_id>",
            "trending":    "/api/trending?language=",
            "charts":      "/api/charts",
            "newReleases": "/api/new-releases?language=",
            "featured":    "/api/featured?language=",
            "lyrics":      "/api/songs/<song_id>/lyrics",
            "similar":     "POST /api/similar  (body: {ids, limit})",
            "search":    "/api/search?query=",
            "songs":     "/api/songs?ids=  or  /api/songs?link=",
            "song_by_id": "/api/songs/<id>",
            "suggestions": "/api/songs/<id>/suggestions",
            "albums":    "/api/albums?id=  or  /api/albums?link=",
            "artists":   "/api/artists?id=  or  /api/artists?link=",
            "playlists": "/api/playlists?id=  or  /api/playlists?link=",
            "search_songs":    "/api/search/songs?query=",
            "search_albums":   "/api/search/albums?query=",
            "search_artists":  "/api/search/artists?query=",
            "search_playlists":"/api/search/playlists?query=",
        }
    })


# ─── SONGS ────────────────────────────────────────────────────────────────────

@app.route("/api/songs")
def get_songs():
    ids  = request.args.get("ids")
    link = request.args.get("link")

    if not ids and not link:
        return err("Either song IDs or link is required")

    if link:
        match = re.search(r"jiosaavn\.com/song/[^/]+/([^/?]+)", link)
        token = match.group(1) if match else None
        if not token:
            return err("Invalid JioSaavn song link")
        data = jiosaavn_fetch("webapi.get", {"token": token, "type": "song"})
        songs = data.get("songs") or []
    else:
        data = jiosaavn_fetch("song.getDetails", {"pids": ids})
        songs = data.get("songs") or []

    if not songs:
        return err("Song not found", 404)

    return ok([build_song(s) for s in songs])


@app.route("/api/songs/<song_id>")
def get_song_by_id(song_id):
    data = jiosaavn_fetch("song.getDetails", {"pids": song_id})
    songs = data.get("songs") or []
    if not songs:
        return err("Song not found", 404)
    return ok([build_song(s) for s in songs])


@app.route("/api/songs/<song_id>/suggestions")
def get_song_suggestions(song_id):
    limit = int(request.args.get("limit", 10))

    # Step 1: create station
    encoded_id = json.dumps([song_id.replace(" ", "%20")])
    st_data = jiosaavn_fetch(
        "webradio.createEntityStation",
        {"entity_id": encoded_id, "entity_type": "queue"},
        ctx="android"
    )
    station_id = (st_data or {}).get("stationid")
    if not station_id:
        return err("Could not create station", 500)

    # Step 2: fetch suggestions
    sg_data = jiosaavn_fetch(
        "webradio.getSong",
        {"stationid": station_id, "k": limit},
        ctx="android"
    )
    if not sg_data:
        return err("No suggestions found", 404)

    suggestions = []
    for key, val in sg_data.items():
        if key == "stationid":
            continue
        if isinstance(val, dict) and val.get("song"):
            suggestions.append(build_song(val["song"]))

    return ok(suggestions[:limit])


# ─── ALBUMS ───────────────────────────────────────────────────────────────────

@app.route("/api/albums")
def get_album():
    album_id = request.args.get("id")
    link     = request.args.get("link")

    if not album_id and not link:
        return err("Either album ID or link is required")

    if link:
        match = re.search(r"jiosaavn\.com/album/[^/]+/([^/?]+)", link)
        token = match.group(1) if match else None
        if not token:
            return err("Invalid JioSaavn album link")
        data = jiosaavn_fetch("webapi.get", {"token": token, "type": "album"})
    else:
        data = jiosaavn_fetch("content.getAlbumDetails", {"albumid": album_id})

    # An id that belongs to a single rather than an album comes back as a shell
    # with empty fields, so check for real content and not just a 200.
    if not data or not data.get("id") or not data.get("title"):
        return err("Album not found", 404)

    return ok(build_album(data))


# ─── PLAYLISTS ────────────────────────────────────────────────────────────────

@app.route("/api/playlists")
def get_playlist():
    pl_id = request.args.get("id")
    link  = request.args.get("link")
    page  = int(request.args.get("page", 0))
    limit = int(request.args.get("limit", 10))

    if not pl_id and not link:
        return err("Either playlist ID or link is required")

    if link:
        match = re.search(
            r"(?:jiosaavn\.com|saavn\.com)/(?:featured|s/playlist)/[^/]+/([^/?]+)|/([^/?]+)$",
            link
        )
        if match:
            token = match.group(1) or match.group(2)
        else:
            token = None
        if not token:
            return err("Invalid JioSaavn playlist link")
        data = jiosaavn_fetch("webapi.get", {"token": token, "type": "playlist", "n": limit, "p": page})
    else:
        data = jiosaavn_fetch("playlist.getDetails", {"listid": pl_id, "n": limit, "p": page})

    if not data or not data.get("id"):
        return err("Playlist not found", 404)

    playlist = build_playlist(data)
    playlist["songs"] = playlist.get("songs", [])[:limit]
    return ok(playlist)


# ─── ARTISTS ──────────────────────────────────────────────────────────────────

@app.route("/api/artists")
def get_artist():
    artist_id  = request.args.get("id")
    link       = request.args.get("link")
    page       = int(request.args.get("page", 0))
    song_count = int(request.args.get("songCount", 10))
    album_count= int(request.args.get("albumCount", 10))
    sort_by    = request.args.get("sortBy", "popularity")
    sort_order = request.args.get("sortOrder", "desc")

    if not artist_id and not link:
        return err("Either artist ID or link is required")

    params = {
        "n_song": song_count, "n_album": album_count,
        "page": page, "sort_order": sort_order, "category": sort_by,
    }

    if link:
        match = re.search(r"jiosaavn\.com/artist/[^/]+/([^/?]+)", link)
        token = match.group(1) if match else None
        if not token:
            return err("Invalid JioSaavn artist link")
        params.update({"token": token, "type": "artist"})
        data = jiosaavn_fetch("webapi.get", params)
    else:
        params["artistId"] = artist_id
        data = jiosaavn_fetch("artist.getArtistPageDetails", params)

    if not data:
        return err("Artist not found", 404)

    return ok(build_artist(data))


@app.route("/api/artists/<artist_id>")
def get_artist_by_id(artist_id):
    page       = int(request.args.get("page", 0))
    song_count = int(request.args.get("songCount", 10))
    album_count= int(request.args.get("albumCount", 10))
    sort_by    = request.args.get("sortBy", "popularity")
    sort_order = request.args.get("sortOrder", "desc")

    data = jiosaavn_fetch("artist.getArtistPageDetails", {
        "artistId": artist_id,
        "n_song": song_count, "n_album": album_count,
        "page": page, "sort_order": sort_order, "category": sort_by,
    })
    if not data:
        return err("Artist not found", 404)
    return ok(build_artist(data))


@app.route("/api/artists/<artist_id>/songs")
def get_artist_songs(artist_id):
    page       = int(request.args.get("page", 0))
    sort_by    = request.args.get("sortBy", "popularity")
    sort_order = request.args.get("sortOrder", "desc")

    data = jiosaavn_fetch("artist.getArtistMoreSong", {
        "artistId": artist_id, "page": page,
        "sort_order": sort_order, "category": sort_by,
    })
    if not data:
        return err("Artist songs not found", 404)

    top = data.get("topSongs") or {}
    songs = [build_song(s) for s in (top.get("songs") or [])]
    return ok({"total": top.get("total"), "songs": songs})


@app.route("/api/artists/<artist_id>/albums")
def get_artist_albums(artist_id):
    page       = int(request.args.get("page", 0))
    sort_by    = request.args.get("sortBy", "popularity")
    sort_order = request.args.get("sortOrder", "desc")

    data = jiosaavn_fetch("artist.getArtistMoreAlbum", {
        "artistId": artist_id, "page": page,
        "sort_order": sort_order, "category": sort_by,
    })
    if not data:
        return err("Artist albums not found", 404)

    top = data.get("topAlbums") or {}
    albums = [build_album(a) for a in (top.get("albums") or [])]
    return ok({"total": top.get("total"), "albums": albums})


# ─── SEARCH ───────────────────────────────────────────────────────────────────

@app.route("/api/search")
def search_all():
    query = request.args.get("query", "").strip()
    if not query:
        return err("query parameter is required")

    data = jiosaavn_fetch("autocomplete.get", {"query": query})
    if not data:
        return err(f"No results found for '{query}'", 404)

    return ok(build_search_all(data))


@app.route("/api/search/songs")
def search_songs():
    query = request.args.get("query", "").strip()
    page  = int(request.args.get("page", 0))
    limit = int(request.args.get("limit", 10))

    if not query:
        return err("query parameter is required")

    data = jiosaavn_fetch("search.getResults", {"q": query, "p": page, "n": limit})
    return ok(build_search_songs(data, limit))


@app.route("/api/search/albums")
def search_albums():
    query = request.args.get("query", "").strip()
    page  = int(request.args.get("page", 0))
    limit = int(request.args.get("limit", 10))

    if not query:
        return err("query parameter is required")

    data = jiosaavn_fetch("search.getAlbumResults", {"q": query, "p": page, "n": limit})
    return ok(build_search_albums(data, limit))


@app.route("/api/search/artists")
def search_artists():
    query = request.args.get("query", "").strip()
    page  = int(request.args.get("page", 0))
    limit = int(request.args.get("limit", 10))

    if not query:
        return err("query parameter is required")

    data = jiosaavn_fetch("search.getArtistResults", {"q": query, "p": page, "n": limit})
    return ok(build_search_artists(data, limit))


@app.route("/api/search/playlists")
def search_playlists():
    query = request.args.get("query", "").strip()
    page  = int(request.args.get("page", 0))
    limit = int(request.args.get("limit", 10))

    if not query:
        return err("query parameter is required")

    data = jiosaavn_fetch("search.getPlaylistResults", {"q": query, "p": page, "n": limit})
    return ok(build_search_playlists(data, limit))


# ==========================================================================
# MusicArea: discovery, browse and the recommendation feed
# ==========================================================================

def _payload():
    return request.get_json(silent=True) or {}


def _int_arg(name, default, low=1, high=100):
    try:
        value = int(request.args.get(name, default))
    except (TypeError, ValueError):
        return default
    return max(low, min(high, value))


@app.route("/api/feed", methods=["POST"])
def api_feed():
    """The personalised half of the home screen.

    Takes the listener's local event log and returns several shelves. All of the
    shelves are scored from a single shared candidate pool, so the whole screen
    costs one recall pass rather than one per row.
    """
    body = _payload()
    history = body.get("history") or []
    mood = body.get("mood") or None
    limit = max(6, min(40, int(body.get("limit") or 24)))

    profile = recommender.build_profile(history)
    pool = recommender.generate_candidates(profile, mood=mood, wide=True)

    rows = []
    used = set()

    def add_row(row_id, title, subtitle, result):
        items = [i for i in result["items"] if i["id"] not in used]
        if not items:
            return
        used.update(i["id"] for i in items)
        rows.append({
            "id": row_id, "title": title, "subtitle": subtitle,
            "kind": "songs", "items": items, "meta": result.get("meta", {}),
        })

    primary = recommender.recommend(profile=profile, pool=pool, limit=limit,
                                    weight_profile="default")
    add_row(
        "made-for-you",
        "Made for you" if not profile["coldStart"] else "Start here",
        ("Tuned to your listening" if not profile["coldStart"]
         else "Play a few tracks and this becomes yours"),
        primary,
    )

    if not profile["coldStart"]:
        seeds = profile["seeds"]
        if seeds:
            seed = seeds[0]
            seed_history = [h for h in history if h.get("id") == seed["id"]] or [{
                "id": seed["id"], "name": seed["name"], "event": "like",
            }]
            seed_profile = recommender.build_profile(seed_history)
            add_row(
                "because-you-played",
                f"Because you played {seed['name']}" if seed.get("name") else "More like this",
                seed.get("artist") or "",
                recommender.recommend(profile=seed_profile, pool=pool, limit=16,
                                      weight_profile="radio", salt=str(seed["id"]),
                                      exclude=used | profile["heard"]),
            )

        add_row(
            "discover",
            "Discovery",
            "Artists you have not played yet",
            recommender.recommend(profile=profile, pool=pool, limit=16,
                                  weight_profile="discover", exclude=used),
        )
        add_row(
            "fresh-for-you",
            "Fresh drops for you",
            "New releases that fit your taste",
            recommender.recommend(profile=profile, pool=pool, limit=16,
                                  weight_profile="fresh", exclude=used),
        )

        # Heavy rotation is plain history, not a prediction.
        rotation_ids = [s["id"] for s in profile["seeds"][:12]]
        rotation = catalog.songs_by_ids(rotation_ids)
        if rotation:
            order = {sid: i for i, sid in enumerate(rotation_ids)}
            rotation.sort(key=lambda s: order.get(s["id"], 99))
            rows.append({
                "id": "heavy-rotation", "title": "On repeat",
                "subtitle": "Your most played lately", "kind": "songs",
                "items": rotation, "meta": {},
            })

    return ok({
        "rows": rows,
        "profile": {
            "coldStart": profile["coldStart"],
            "strength": profile["strength"],
            "events": profile["events"],
            # topArtists is truncated for display, so the true totals are sent
            # separately. The UI used to report the truncated length as the
            # artist count, which understated it for anyone with a real history.
            "artistCount": len(profile["artists"]),
            "languageCount": len(profile["languages"]),
            "topArtists": profile["topArtists"][:8],
            "topLanguages": profile["topLanguages"],
            "eraCenter": round(profile["eraCenter"]) if profile["eraCenter"] else None,
            "mainstream": profile["mainstream"],
        },
        "candidates": len(pool),
    })


@app.route("/api/mixes", methods=["POST"])
def api_mixes():
    """Ready made playlists generated from the listener's own taste profile."""
    body = _payload()
    per_mix = max(10, min(40, int(body.get("perMix") or 24)))
    result = recommender.mixes(history=body.get("history") or [], per_mix=per_mix)
    return ok(result)


@app.route("/api/browse")
def api_browse():
    """Editorial shelves. Identical for everyone, so aggressively cacheable."""
    language = (request.args.get("language") or "hindi").lower()
    trending_songs, chart_cards, releases, playlists, fresh_songs = catalog.parallel([
        lambda: catalog.trending(language),
        lambda: catalog.charts(limit=12),
        lambda: catalog.new_releases(language, limit=18),
        lambda: catalog.featured_playlists(language, limit=18),
        lambda: catalog.new_release_songs(language, limit=20),
    ])

    rows = []
    if trending_songs:
        rows.append({"id": "trending", "title": f"Trending in {language.title()}",
                     "subtitle": "What the country has on repeat",
                     "kind": "songs", "items": trending_songs[:24]})
    if chart_cards:
        rows.append({"id": "charts", "title": "Top charts",
                     "subtitle": "Updated daily", "kind": "playlists",
                     "items": chart_cards})
    if fresh_songs:
        rows.append({"id": "new-songs", "title": "Just released",
                     "subtitle": "Singles that landed this week",
                     "kind": "songs", "items": fresh_songs})
    if releases:
        rows.append({"id": "new-releases", "title": "New albums",
                     "subtitle": "Fresh records", "kind": "albums", "items": releases})
    if playlists:
        rows.append({"id": "featured", "title": "Editor's playlists",
                     "subtitle": "Handpicked by humans", "kind": "playlists",
                     "items": playlists})

    return ok({
        "rows": rows,
        "moods": catalog.mood_cards(),
        "languages": catalog.LANGUAGES,
        "language": language,
    })


@app.route("/api/moods")
def api_mood_list():
    """The mood tiles on their own, artwork included."""
    return ok({"moods": catalog.mood_cards()})


@app.route("/api/genres")
def api_genres():
    """Everything the browse and search screens need to build category tiles."""
    languages, moods = catalog.parallel([
        catalog.language_cards,
        catalog.mood_cards,
    ])
    return ok({"languages": languages or [], "moods": moods or []})


@app.route("/api/radio/<song_id>")
def api_radio(song_id):
    """An endless, algorithmically ordered station seeded from one track."""
    station = recommender.radio(song_id, limit=_int_arg("limit", 40, 5, 60))
    if not station.get("items") and not station.get("seed"):
        return err("Could not build a station for that song", 404)
    return ok(station)


@app.route("/api/artists/<artist_id>/radio")
def api_artist_radio(artist_id):
    station = recommender.artist_radio(artist_id, limit=_int_arg("limit", 40, 5, 60))
    if not station.get("items"):
        return err("Could not build a station for that artist", 404)
    return ok(station)


@app.route("/api/similar", methods=["POST"])
def api_similar():
    """"More like this" for an album, playlist or arbitrary selection."""
    body = _payload()
    ids = [str(i) for i in (body.get("ids") or []) if i][:10]
    if not ids:
        return err("ids is required")
    seeds = catalog.songs_by_ids(ids)
    if not seeds:
        return err("None of those songs could be resolved", 404)
    limit = max(4, min(40, int(body.get("limit") or 16)))
    return ok({"items": recommender.similar_to_songs(seeds, limit=limit)})


@app.route("/api/moods/<mood_id>", methods=["GET", "POST"])
def api_mood(mood_id):
    """A mood set, ordered against the listener's taste when one is supplied.

    POST with {"history": [...]} to personalise the order. A plain GET returns
    the catalog order and says so via meta.personalised.
    """
    if not catalog.MOOD_BY_ID.get(mood_id):
        return err("Unknown mood", 404)
    body = _payload()
    limit = max(5, min(60, int(body.get("limit") or request.args.get("limit") or 40)))
    result = recommender.mood_set(mood_id, history=body.get("history") or [], limit=limit)
    if not result.get("items"):
        return err("Could not build that mood right now", 404)
    return ok(result)


@app.route("/api/trending")
def api_trending():
    language = (request.args.get("language") or "hindi").lower()
    return ok({"language": language, "items": catalog.trending(language)})


@app.route("/api/charts")
def api_charts():
    return ok({"items": catalog.charts(request.args.get("language"), limit=_int_arg("limit", 20, 1, 40))})


@app.route("/api/new-releases")
def api_new_releases():
    language = (request.args.get("language") or "hindi").lower()
    return ok({"language": language,
               "items": catalog.new_releases(language, limit=_int_arg("limit", 20, 1, 40))})


@app.route("/api/featured")
def api_featured():
    language = (request.args.get("language") or "hindi").lower()
    return ok({"language": language,
               "items": catalog.featured_playlists(language, limit=_int_arg("limit", 20, 1, 40))})


@app.route("/api/songs/<song_id>/lyrics")
def api_lyrics(song_id):
    song = catalog.song_by_id(song_id)
    if not song:
        return err("Song not found", 404)
    if not song.get("lyricsId"):
        return err("No lyrics available for this song", 404)
    found = catalog.lyrics(song["lyricsId"])
    if not found:
        return err("No lyrics available for this song", 404)
    return ok(found)


@app.route("/api/health")
def api_health():
    return ok({"status": "ok", "cache": CACHE.stats()})


@app.route("/manifest.webmanifest")
def manifest():
    return jsonify({
        "name": "MusicArea",
        "short_name": "MusicArea",
        "description": "A premium music player with an algorithmic feed.",
        "start_url": "/",
        "display": "standalone",
        "background_color": "#07070b",
        "theme_color": "#07070b",
        "icons": [
            {"src": "/static/img/logo.svg", "sizes": "any", "type": "image/svg+xml",
             "purpose": "any maskable"},
        ],
    })


@app.route("/favicon.svg")
def favicon():
    return send_from_directory(app.static_folder, "img/logo.svg")


# ─── 404 fallback ─────────────────────────────────────────────────────────────

@app.errorhandler(404)
def not_found(_):
    return err("Route not found", 404)


@app.errorhandler(Exception)
def handle_error(e):
    # Let real HTTP errors keep their status instead of collapsing to a 500.
    if isinstance(e, HTTPException):
        return err(e.description or e.name, e.code or 500)
    app.logger.exception("Unhandled error on %s", request.path)
    return err("Something went wrong while loading that. Please try again.", 500)


# ─── Entry point (local dev) ──────────────────────────────────────────────────

if __name__ == "__main__":
    app.run(debug=True, port=5000)
