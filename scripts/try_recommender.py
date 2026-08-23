"""Manual smoke test for the recommendation engine.

Run: .venv/bin/python -W ignore scripts/try_recommender.py
"""
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import catalog
import recommender


def as_history(songs, event="play"):
    now = time.time() * 1000
    out = []
    for offset, song in enumerate(songs):
        out.append({
            "id": song["id"],
            "name": song["name"],
            "event": event,
            "at": now - offset * 3600_000,
            "language": song.get("language"),
            "year": song.get("year"),
            "playCount": song.get("playCount"),
            "artists": recommender._song_artists(song),
            "album": song.get("album"),
        })
    return out


def show(items, count=15):
    for item in items[:count]:
        rec = item["recommendation"]
        artist = recommender._primary_artist_name(item)
        print(f"  {rec['rank']:>2}. {item['name'][:38]:<38} {artist[:20]:<20} "
              f"{rec['score']:.3f}  {rec['reason']}  [{','.join(rec['sources'])}]")


print("=" * 100)
print("COLD START (no history)")
t = time.time()
cold = recommender.recommend(limit=12)
print(f"  candidates={cold['meta']['candidates']} in {time.time()-t:.1f}s  coldStart={cold['meta']['coldStart']}")
show(cold["items"], 8)

print()
print("=" * 100)
print("WARM PROFILE: a Punjabi + Hindi pop listener")
seed_songs = []
for query in ["295 sidhu moose wala", "brown munde", "excuses ap dhillon",
              "kesariya", "apna bana le"]:
    found = catalog.search_songs(query, limit=1)
    if found:
        seed_songs.append(found[0])
print("  seeds:", [(s["name"], recommender._primary_artist_name(s), s["language"]) for s in seed_songs])

history = as_history(seed_songs, event="like")
t = time.time()
warm = recommender.recommend(history=history, limit=20)
meta = warm["meta"]
print(f"  candidates={meta['candidates']} scored={meta['scored']} in {time.time()-t:.1f}s")
print(f"  topArtists={[a['name'] for a in meta['topArtists']]}")
print(f"  languages={meta['topLanguages']} era={meta['eraCenter']} mainstream={meta['mainstream']}")
print(f"  discoveryShare={meta['discoveryShare']} profileStrength={meta['profileStrength']}")
show(warm["items"], 20)

artists_in_feed = {}
for item in warm["items"]:
    key = recommender._primary_artist_name(item)
    artists_in_feed[key] = artists_in_feed.get(key, 0) + 1
print("  artist spread:", sorted(artists_in_feed.items(), key=lambda kv: -kv[1])[:8])
print("  unique artists:", len(artists_in_feed), "/", len(warm["items"]))
print("  leaked already-heard:", [i["name"] for i in warm["items"] if i["recommendation"]["familiar"]])

print()
print("=" * 100)
print("SONG RADIO from 'Kesariya'")
kesariya = catalog.search_songs("kesariya", limit=1)[0]
t = time.time()
station = recommender.radio(kesariya["id"], limit=12)
print(f"  seed={station['seed']['name']} candidates={station['meta']['candidates']} in {time.time()-t:.1f}s")
show(station["items"], 12)

print()
print("=" * 100)
print("MOOD: party")
mood = recommender.recommend(history=history, limit=8, mood="party")
show(mood["items"], 8)
