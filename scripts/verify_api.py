"""End to end check of every MusicArea endpoint, in process.

Run: .venv/bin/python -W ignore scripts/verify_api.py
"""
import json
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import recommender  # noqa: E402
from app import app  # noqa: E402

client = app.test_client()
failures = []


def check(label, condition, detail=""):
    status = "PASS" if condition else "FAIL"
    print(f"  [{status}] {label}" + (f"  {detail}" if detail else ""))
    if not condition:
        failures.append(label)


def get(path):
    started = time.time()
    response = client.get(path)
    elapsed = time.time() - started
    return response, elapsed


def post(path, payload):
    started = time.time()
    response = client.post(path, json=payload)
    return response, time.time() - started


def data_of(response):
    body = json.loads(response.data)
    return body.get("data"), body


print("\n== shell and static ==")
res, _ = get("/")
check("GET / returns the app shell", res.status_code == 200 and b"MusicArea" in res.data)
check("shell references the bundle", b"js/app.js" in res.data and b"css/app.css" in res.data)
res, _ = get("/static/css/app.css")
check("stylesheet is served", res.status_code == 200 and len(res.data) > 5000, f"{len(res.data)} bytes")
res, _ = get("/static/js/app.js")
check("script is served", res.status_code == 200 and len(res.data) > 5000, f"{len(res.data)} bytes")
res, _ = get("/static/img/logo.svg")
check("logo is served", res.status_code == 200 and b"<svg" in res.data)
res, _ = get("/favicon.svg")
check("favicon resolves", res.status_code == 200)
res, _ = get("/manifest.webmanifest")
check("manifest is valid json", res.status_code == 200 and json.loads(res.data)["name"] == "MusicArea")
res, _ = get("/api")
check("API index lists endpoints",
      res.status_code == 200 and "feed" in data_of(res)[1]["endpoints"])

print("\n== browse ==")
res, took = get("/api/browse?language=hindi")
browse, _ = data_of(res)
check("GET /api/browse", res.status_code == 200, f"{took:.1f}s")
row_ids = [r["id"] for r in browse["rows"]]
check("browse has trending, charts, releases, featured",
      {"trending", "charts", "new-releases", "featured"} <= set(row_ids), str(row_ids))
check("browse ships moods and languages",
      len(browse["moods"]) >= 8 and len(browse["languages"]) >= 10)
trending_songs = next(r for r in browse["rows"] if r["id"] == "trending")["items"]
check("trending songs are playable", all(s.get("downloadUrl") for s in trending_songs))
check("titles are unescaped", not any("&quot;" in (s["name"] or "") for s in trending_songs))
sample = trending_songs[0]
print(f"        sample: {sample['name']} / {sample['language']} / {len(sample['downloadUrl'])} qualities")

print("\n== cold start feed ==")
res, took = post("/api/feed", {"history": [], "limit": 12})
feed, _ = data_of(res)
check("POST /api/feed with no history", res.status_code == 200, f"{took:.1f}s")
check("cold start flag is set", feed["profile"]["coldStart"] is True)
check("cold feed returns songs", len(feed["rows"][0]["items"]) >= 8,
      f"{len(feed['rows'][0]['items'])} items from {feed['candidates']} candidates")
check("every cold item carries a reason",
      all(i["recommendation"]["reason"] for i in feed["rows"][0]["items"]))

print("\n== warm feed ==")
seeds = []
for query in ["295 sidhu moose wala", "brown munde", "kesariya", "apna bana le", "excuses ap dhillon"]:
    found, _ = data_of(get(f"/api/search/songs?query={query}&limit=1")[0])
    if found["results"]:
        seeds.append(found["results"][0])
check("resolved seed tracks", len(seeds) >= 4, f"{len(seeds)} seeds")

now = time.time() * 1000
# Mirror what the browser client sends: musical credits only, no lyricists.
history = [{
    "id": s["id"], "name": s["name"], "event": "like", "at": now - i * 3600_000,
    "language": s["language"], "year": s["year"], "playCount": s["playCount"],
    "artists": [{"id": a["id"], "name": a["name"]} for a in recommender._song_artists(s)],
    "album": {"id": s["album"]["id"], "name": s["album"]["name"]},
} for i, s in enumerate(seeds)]

res, took = post("/api/feed", {"history": history, "limit": 20})
warm, _ = data_of(res)
check("POST /api/feed with history", res.status_code == 200, f"{took:.1f}s")
profile = warm["profile"]
check("profile is warm", profile["coldStart"] is False)
check("profile learned artists", len(profile["topArtists"]) >= 3,
      str([a["name"] for a in profile["topArtists"][:5]]))
check("profile learned languages", len(profile["topLanguages"]) >= 1, str(profile["topLanguages"]))
check("profile has an era centre", bool(profile["eraCenter"]), str(profile["eraCenter"]))

warm_rows = {r["id"]: r for r in warm["rows"]}
print(f"        rows: {[(r['id'], len(r['items'])) for r in warm['rows']]}")
check("made-for-you row present", "made-for-you" in warm_rows)
check("because-you-played row present", "because-you-played" in warm_rows)
check("discovery row present", "discover" in warm_rows)
check("on-repeat row present", "heavy-rotation" in warm_rows)

seed_ids = {s["id"] for s in seeds}
main_items = warm_rows["made-for-you"]["items"]
check("no already-heard track in the main row",
      not any(i["id"] in seed_ids for i in main_items))
all_ids = [i["id"] for row in warm["rows"] for i in row["items"] if row["id"] != "heavy-rotation"]
check("no duplicate track across rows", len(all_ids) == len(set(all_ids)),
      f"{len(all_ids)} items")
artist_counts = {}
for item in main_items:
    key = (item["artists"]["primary"] or [{}])[0].get("name", "?")
    artist_counts[key] = artist_counts.get(key, 0) + 1
check("no artist dominates the main row", max(artist_counts.values()) <= 2,
      f"{len(artist_counts)} artists across {len(main_items)} tracks")
check("discovery share is meaningful",
      warm_rows["made-for-you"]["meta"]["discoveryShare"] > 0.1,
      str(warm_rows["made-for-you"]["meta"]["discoveryShare"]))
print("        top picks:")
for item in main_items[:6]:
    rec = item["recommendation"]
    print(f"          {item['name'][:34]:<34} {rec['reason']}")

print("\n== stations ==")
res, took = get(f"/api/radio/{seeds[0]['id']}?limit=15")
station, _ = data_of(res)
check("GET /api/radio/<id>", res.status_code == 200, f"{took:.1f}s")
check("station has a seed", station["seed"]["id"] == seeds[0]["id"])
check("station returns tracks", len(station["items"]) >= 10, f"{len(station['items'])} tracks")
check("station excludes its own seed", seeds[0]["id"] not in {i["id"] for i in station["items"]})
check("station tracks are playable", all(i.get("downloadUrl") for i in station["items"]))

artist_id = seeds[0]["artists"]["primary"][0]["id"]
res, took = get(f"/api/artists/{artist_id}/radio?limit=12")
check("GET /api/artists/<id>/radio", res.status_code == 200 and len(data_of(res)[0]["items"]) >= 8,
      f"{took:.1f}s")

res, _ = post("/api/similar", {"ids": [s["id"] for s in seeds[:3]], "limit": 10})
similar, _ = data_of(res)
check("POST /api/similar", res.status_code == 200 and len(similar["items"]) >= 6,
      f"{len(similar['items'])} items")

print("\n== browse detail ==")
res, _ = get("/api/moods/party?limit=15")
mood, _ = data_of(res)
check("GET /api/moods/party", res.status_code == 200 and len(mood["items"]) >= 10)
check("unknown mood is a 404", get("/api/moods/nope")[0].status_code == 404)
res, _ = get("/api/trending?language=punjabi")
check("GET /api/trending", res.status_code == 200 and len(data_of(res)[0]["items"]) > 0)
res, _ = get("/api/charts")
check("GET /api/charts", res.status_code == 200 and len(data_of(res)[0]["items"]) > 0)
res, _ = get("/api/new-releases?language=hindi")
check("GET /api/new-releases", res.status_code == 200 and len(data_of(res)[0]["items"]) > 0)
res, _ = get("/api/featured?language=hindi")
check("GET /api/featured", res.status_code == 200 and len(data_of(res)[0]["items"]) > 0)

print("\n== entities and search ==")
albums, _ = data_of(get("/api/search/albums?query=brahmastra&limit=3")[0])
album_id = albums["results"][0]["id"]
res, _ = get(f"/api/albums?id={album_id}")
album, _ = data_of(res)
check("GET /api/albums", res.status_code == 200 and len(album["songs"]) > 0,
      f"{album['name']} / {len(album['songs'])} songs")

playlists, _ = data_of(get("/api/search/playlists?query=romantic&limit=3")[0])
playlist_id = playlists["results"][0]["id"]
res, _ = get(f"/api/playlists?id={playlist_id}&limit=20")
playlist, _ = data_of(res)
check("GET /api/playlists", res.status_code == 200 and len(playlist["songs"]) > 0,
      f"{playlist['name']} / {len(playlist['songs'])} songs")

res, _ = get(f"/api/artists/{artist_id}?songCount=10")
artist, _ = data_of(res)
check("GET /api/artists/<id>", res.status_code == 200 and artist["name"],
      f"{artist['name']}")
res, _ = get("/api/search?query=arijit")
suggest, _ = data_of(res)
check("GET /api/search autocomplete",
      res.status_code == 200 and len(suggest["songs"]["results"]) > 0)

print("\n== error handling ==")
check("unknown route is a json 404", get("/api/nope")[0].status_code == 404)
check("missing search query is a 400", get("/api/search/songs")[0].status_code == 400)
check("similar without ids is a 400", post("/api/similar", {})[0].status_code == 400)
check("bad song id for radio fails cleanly", get("/api/radio/zzzzzz")[0].status_code in (404, 200))
res, _ = get("/api/songs/zzzzzzzz/lyrics")
check("lyrics for a bad id is a 404", res.status_code == 404)

print("\n== caching ==")
_, cold = get("/api/browse?language=tamil")
_, warm_time = get("/api/browse?language=tamil")
check("second browse call is cache-served", warm_time < max(0.25, cold * 0.5),
      f"cold {cold:.2f}s then {warm_time:.3f}s")

print("\n" + "=" * 62)
if failures:
    print(f"FAILED {len(failures)} check(s):")
    for name in failures:
        print(f"  - {name}")
    sys.exit(1)
print("All checks passed.")
