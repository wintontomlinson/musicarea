"""Stub of the MusicArea API, for developing and testing the frontend offline.

The real API proxies JioSaavn, which is geo-sensitive and needs network access,
and the recommender needs a warm listening profile before it emits anything
interesting. That makes the personalised paths awkward to exercise. This serves
the same envelope and payload shapes as app.py, including the parts that are easy
to get wrong:

  - the {"success": true, "data": ...} envelope every endpoint wraps
  - a cold-start feed (one row) versus a warm one (five rows)
  - `heavy-rotation` items carrying no `recommendation` block at all
  - mixes keyed `name`/`items`/`note`, not `title`/`songs`/`reason`
  - song radio including a `seed`, artist radio not
  - 404 from the lyrics endpoint, meaning "none available" rather than an error
  - search results with a null `title` and a null `type`
  - the 128 KiB request body limit

Usage:

    python3 scripts/stub_api.py &
    cd web && FLASK_API_BASE=http://127.0.0.1:5099 npm run dev

`POST /api/_received` reports what the frontend last sent to the feed and mixes
endpoints, which is how the history allow-list and payload size are checked.
"""
import json
import re
from http.server import BaseHTTPRequestHandler, HTTPServer

PORT = 5099

# Records what the frontend actually sent, so the test can assert on it.
RECEIVED = {"feed": None, "mixes": None}


def silent_wav(seconds=30, rate=8000):
    """A valid, playable WAV of silence.

    Built by hand rather than shipped as a binary so this file stays readable and
    self-contained. Serving real audio is what lets the player be driven end to
    end: with an unreachable URL the engine correctly treats every track as
    unplayable and there is nothing to test.
    """
    frames = rate * seconds
    data_size = frames  # 8-bit mono
    header = b"RIFF" + (36 + data_size).to_bytes(4, "little") + b"WAVE"
    header += b"fmt " + (16).to_bytes(4, "little")
    header += (1).to_bytes(2, "little")       # PCM
    header += (1).to_bytes(2, "little")       # mono
    header += rate.to_bytes(4, "little")
    header += rate.to_bytes(4, "little")      # byte rate
    header += (1).to_bytes(2, "little")       # block align
    header += (8).to_bytes(2, "little")       # bits per sample
    header += b"data" + data_size.to_bytes(4, "little")
    # 128 is the zero point for unsigned 8-bit PCM.
    return header + bytes([128]) * data_size


SILENCE = silent_wav()


def song(i, name, artist_id, artist_name, language="hindi", year="2022"):
    return {
        "id": f"song{i}",
        "name": name,
        "type": "song",
        "year": year,
        "duration": 220,
        "language": language,
        "playCount": 1000000 + i,
        "hasLyrics": True,
        "album": {"id": f"alb{i}", "name": f"Album {i}"},
        "artists": {
            "primary": [{"id": artist_id, "name": artist_name}],
            "all": [{"id": artist_id, "name": artist_name}],
        },
        "image": [
            {"quality": "50x50", "url": "https://c.saavncdn.com/x-50x50.jpg"},
            {"quality": "150x150", "url": "https://c.saavncdn.com/x-150x150.jpg"},
            {"quality": "500x500", "url": "https://c.saavncdn.com/x-500x500.jpg"},
        ],
        # Point at this server's own /media endpoint rather than the real CDN, so
        # playback actually succeeds offline. An unreachable stream sends the
        # engine into its skip-and-retry path, which makes the player impossible
        # to exercise (and, in a headless browser, tends to kill the tab).
        "downloadUrl": [
            {"quality": "96kbps", "url": f"http://127.0.0.1:{PORT}/media/silence.wav"},
            {"quality": "320kbps", "url": f"http://127.0.0.1:{PORT}/media/silence.wav"},
        ],
    }


def recommended(i, name, artist_id, artist_name, reason, rank):
    s = song(i, name, artist_id, artist_name)
    s["recommendation"] = {
        "rank": rank,
        "score": round(0.9 - rank * 0.03, 5),
        "reason": reason,
        "signals": {
            "artist": 0.91, "collab": 0.62, "session": 0.0, "language": 1.0,
            "era": 0.74, "popularity": 0.88, "freshness": 0.33, "recall": 0.85,
        },
        "sources": ["artist", "collab"],
        "discovery": rank % 4 == 0,
        "familiar": False,
    }
    return s


ARTISTS = [("459320", "Arijit Singh"), ("455130", "Pritam"), ("881158", "Shreya Ghoshal")]


def songs(n, offset=0, reason="Because you listen to Arijit Singh"):
    out = []
    for i in range(n):
        aid, aname = ARTISTS[i % len(ARTISTS)]
        out.append(recommended(offset + i, f"Track {offset + i}", aid, aname, reason, i + 1))
    return out


def plain_songs(n, offset=0):
    out = []
    for i in range(n):
        aid, aname = ARTISTS[i % len(ARTISTS)]
        out.append(song(offset + i, f"Track {offset + i}", aid, aname))
    return out


def mood_cards():
    return [
        {"id": "romance", "name": "Romance", "hue": 336, "image": "https://images.unsplash.com/photo-1"},
        {"id": "party", "name": "Party", "hue": 24, "image": "https://images.unsplash.com/photo-2"},
    ]


def browse():
    return {
        "rows": [
            {"id": "trending", "title": "Trending now", "kind": "songs", "items": plain_songs(8)},
            {"id": "new", "title": "New releases", "kind": "songs", "items": plain_songs(6, 20)},
        ],
        "moods": mood_cards(),
        "languages": ["hindi", "english"],
        "selectedLanguages": ["hindi"],
        "language": "hindi",
    }


def feed(history):
    """Mirror the real handler: cold start yields one row, warm yields five."""
    positive = sum(
        1 for h in history if h.get("event") not in ("skip", "dislike")
    )
    cold = positive < 1
    if cold:
        return {
            "rows": [{
                "id": "made-for-you", "title": "Start here",
                "subtitle": "Play a few tracks and this becomes yours",
                "kind": "songs", "items": songs(12), "meta": {"coldStart": True},
            }],
            "profile": {
                "coldStart": True, "strength": 0.0, "events": len(history),
                "artistCount": 0, "languageCount": 0, "topArtists": [],
                "recentArtists": [], "topLanguages": [], "preferredLanguages": ["hindi"],
                "eraCenter": None, "mainstream": None,
            },
            "candidates": 120,
        }
    return {
        "rows": [
            {"id": "made-for-you", "title": "Made for you", "subtitle": "Tuned to your listening",
             "kind": "songs", "items": songs(12), "meta": {"coldStart": False}},
            {"id": "because-you-played", "title": "Because you played Track 1",
             "subtitle": "Arijit Singh", "kind": "songs",
             "items": songs(10, 40, "Because you played Track 1"), "meta": {}},
            {"id": "discover", "title": "Discovery", "subtitle": "Artists you have not played yet",
             "kind": "songs", "items": songs(10, 60, "Similar to Arijit Singh"), "meta": {}},
            {"id": "fresh-for-you", "title": "Fresh drops for you",
             "subtitle": "New releases that fit your taste", "kind": "songs",
             "items": songs(8, 80, "New release in Hindi"), "meta": {}},
            # heavy-rotation deliberately carries NO recommendation block.
            {"id": "heavy-rotation", "title": "On repeat", "subtitle": "Your most played lately",
             "kind": "songs", "items": plain_songs(6, 100), "meta": {}},
        ],
        "profile": {
            "coldStart": False, "strength": 0.83, "events": len(history),
            "artistCount": 12, "languageCount": 2,
            "topArtists": [{"id": a, "name": n, "weight": 12.4} for a, n in ARTISTS],
            "recentArtists": [{"id": ARTISTS[0][0], "name": ARTISTS[0][1]}],
            "topLanguages": ["hindi", "punjabi"], "preferredLanguages": ["hindi"],
            "eraCenter": 2021, "mainstream": 0.74,
        },
        "candidates": 312,
    }


def mixes(history):
    positive = sum(1 for h in history if h.get("event") not in ("skip", "dislike"))
    if positive < 1:
        return {"mixes": [], "meta": {"coldStart": True, "reason": "not enough listening yet"}}
    def mix(mid, name, subtitle, note, offset):
        items = songs(14, offset)
        return {
            "id": mid, "name": name, "subtitle": subtitle, "note": note,
            "type": "mix", "songCount": len(items),
            "image": items[0]["image"],
            "covers": [s["image"] for s in items[:4]],
            "items": items,
        }
    return {
        "mixes": [
            mix("artist-459320", "Arijit Singh Mix", "Arijit Singh, Pritam and more",
                "Built around Arijit Singh and the artists who share playlists with them.", 200),
            mix("language-hindi", "Hindi Mix", "Your Hindi listening",
                "Your Hindi listening, ordered by fit.", 300),
            mix("discovery", "Discovery Mix", "Artists you have never played",
                "Artists you have never played, picked from the company your favourites keep.", 400),
        ],
        "meta": {"coldStart": False, "candidates": 312, "count": 3, "profileStrength": 0.83},
    }


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, *args):
        pass

    def _send(self, payload, status=200):
        body = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def ok(self, data):
        self._send({"success": True, "data": data})

    def err(self, message, status):
        self._send({"success": False, "message": message}, status)

    def _send_media(self):
        """Serve the silence clip, with the CORS header the visualizer probes for."""
        self.send_response(200)
        self.send_header("Content-Type", "audio/wav")
        self.send_header("Content-Length", str(len(SILENCE)))
        self.send_header("Accept-Ranges", "none")
        # Present so the visualizer's cross-origin check passes and the analyser
        # path gets exercised too.
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(SILENCE)

    def do_GET(self):
        path = self.path.split("?")[0]
        if path.startswith("/media/"):
            return self._send_media()
        if path == "/api/browse":
            return self.ok(browse())
        if path == "/api/charts":
            return self.ok({"items": [
                {"id": "chart1", "name": "Top 50 India", "type": "playlist",
                 "image": plain_songs(1)[0]["image"]}]})
        if re.fullmatch(r"/api/radio/[^/]+", path):
            return self.ok({
                "seed": song(1, "Track 1", *ARTISTS[0]),
                "items": songs(20, 500, "Because you played Track 1"),
                "meta": {"candidates": 288, "returned": 20, "seedName": "Track 1"},
            })
        if re.fullmatch(r"/api/artists/[^/]+/radio", path):
            return self.ok({"items": songs(20, 600), "meta": {"candidates": 240, "artist": "Arijit Singh"}})
        # Lyrics: "nolyrics" exercises the 404 branch.
        m = re.fullmatch(r"/api/songs/([^/]+)/lyrics", path)
        if m:
            if m.group(1) == "nolyrics":
                return self.err("No lyrics available for this song", 404)
            return self.ok({
                "lyrics": "First line<br>Second line<br><br>After a gap",
                "copyright": "Stub Records", "snippet": "First line",
            })
        m = re.fullmatch(r"/api/songs/([^/]+)", path)
        if m:
            return self.ok([song(1, "Track 1", *ARTISTS[0])])
        if path == "/api/songs":
            return self.ok(plain_songs(3))
        if path == "/api/search":
            return self.ok({
                "topQuery": {"results": [{"id": "a1", "title": "Arijit Singh", "type": "artist"}]},
                # A null title and a null type: both legal upstream, both used to crash.
                "songs": {"results": [
                    {"id": "s1", "title": "Track 1", "type": "song", "primaryArtists": "Arijit Singh"},
                    {"id": "s2", "title": None, "type": "song"},
                    {"id": "s3", "title": "Bad type", "type": None},
                ]},
                "albums": {"results": []}, "artists": {"results": []}, "playlists": {"results": []},
            })
        if path == "/api/search/songs":
            return self.ok({"results": plain_songs(5)})
        if path == "/api/moods":
            return self.ok({"items": mood_cards()})
        if re.fullmatch(r"/api/moods/[^/]+", path):
            return self.ok({"mood": mood_cards()[0], "items": plain_songs(10),
                            "meta": {"personalised": False}})
        if path == "/api/playlists":
            return self.ok({"id": "pl1", "name": "Stub Playlist", "type": "playlist",
                            "songs": plain_songs(10), "image": plain_songs(1)[0]["image"]})
        if path == "/api/albums":
            return self.ok({"id": "alb1", "name": "Stub Album", "type": "album",
                            "songs": plain_songs(8), "image": plain_songs(1)[0]["image"]})
        if re.fullmatch(r"/api/artists/[^/]+", path):
            return self.ok({"id": "459320", "name": "Arijit Singh", "type": "artist",
                            "image": plain_songs(1)[0]["image"], "topSongs": plain_songs(10),
                            "topAlbums": [], "singles": [], "similarArtists": []})
        if path == "/api/health":
            return self.ok({"status": "ok"})
        return self.err("Not found", 404)

    def do_POST(self):
        length = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(length)
        # Enforce the real 128 KiB limit so an oversized payload fails here too.
        if length > 128 * 1024:
            return self.err("Request body is too large", 413)
        try:
            body = json.loads(raw or b"{}")
        except Exception:
            body = {}
        history = body.get("history") or []
        path = self.path.split("?")[0]
        if path == "/api/feed":
            RECEIVED["feed"] = {"count": len(history), "bytes": length,
                                "sample": history[-1] if history else None,
                                "languages": body.get("languages")}
            return self.ok(feed(history))
        if path == "/api/mixes":
            RECEIVED["mixes"] = {"count": len(history), "bytes": length}
            return self.ok(mixes(history))
        if path == "/api/similar":
            return self.ok({"items": songs(10, 700)})
        if re.fullmatch(r"/api/moods/[^/]+", path):
            return self.ok({"mood": mood_cards()[0], "items": songs(10, 800),
                            "meta": {"personalised": True}})
        if path == "/api/_received":
            return self.ok(RECEIVED)
        return self.err("Not found", 404)


if __name__ == "__main__":
    HTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
