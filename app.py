"""
app.py — JioSaavn API  |  Flask + Vercel Edition
Credits: @ab_devs
"""

import json
import re
from flask import Flask, jsonify, request, make_response

from helpers import jiosaavn_fetch
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
    response.headers["Access-Control-Allow-Methods"] = "GET, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    return response

@app.after_request
def after_request(response):
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
    return jsonify({
        "success": True,
        "message": "JioSaavn API — Credits: @ab_devs",
        "endpoints": {
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

    if not data:
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

    if not data:
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


# ─── 404 fallback ─────────────────────────────────────────────────────────────

@app.errorhandler(404)
def not_found(_):
    return err("Route not found", 404)


@app.errorhandler(Exception)
def handle_error(e):
    return err(str(e), 500)


# ─── Entry point (local dev) ──────────────────────────────────────────────────

if __name__ == "__main__":
    app.run(debug=True, port=5000)
