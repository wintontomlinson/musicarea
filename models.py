"""
models.py — Payload transformation functions for JioSaavn API
Credits: @ab_devs
"""

import json
from helpers import create_download_links, create_image_links


# ─── Artist Map ───────────────────────────────────────────────────────────────

def build_artist_map(artist: dict) -> dict:
    return {
        "id":    artist.get("id"),
        "name":  artist.get("name"),
        "role":  artist.get("role"),
        "image": create_image_links(artist.get("image", "")),
        "type":  artist.get("type"),
        "url":   artist.get("perma_url"),
    }


# ─── Song ─────────────────────────────────────────────────────────────────────

def build_song(song: dict) -> dict:
    mi = song.get("more_info") or {}
    artist_map = mi.get("artistMap") or {}
    return {
        "id":             song.get("id"),
        "name":           song.get("title"),
        "type":           song.get("type"),
        "year":           song.get("year") or None,
        "releaseDate":    mi.get("release_date") or None,
        "duration":       int(mi["duration"]) if mi.get("duration") else None,
        "label":          mi.get("label") or None,
        "explicitContent": song.get("explicit_content") == "1",
        "playCount":      int(song["play_count"]) if song.get("play_count") else None,
        "language":       song.get("language"),
        "hasLyrics":      mi.get("has_lyrics") == "true",
        "lyricsId":       mi.get("lyrics_id") or None,
        "url":            song.get("perma_url"),
        "copyright":      mi.get("copyright_text") or None,
        "album": {
            "id":   mi.get("album_id") or None,
            "name": mi.get("album") or None,
            "url":  mi.get("album_url") or None,
        },
        "artists": {
            "primary":  [build_artist_map(a) for a in artist_map.get("primary_artists", [])],
            "featured": [build_artist_map(a) for a in artist_map.get("featured_artists", [])],
            "all":      [build_artist_map(a) for a in artist_map.get("artists", [])],
        },
        "image":       create_image_links(song.get("image", "")),
        "downloadUrl": create_download_links(mi.get("encrypted_media_url", "")),
    }


# ─── Album ────────────────────────────────────────────────────────────────────

def build_album(album: dict) -> dict:
    mi = album.get("more_info") or {}
    artist_map = mi.get("artistMap") or {}
    songs_raw = album.get("list") or []
    return {
        "id":              album.get("id"),
        "name":            album.get("title"),
        "description":     album.get("header_desc"),
        "type":            album.get("type"),
        "year":            int(album["year"]) if album.get("year") else None,
        "playCount":       int(album["play_count"]) if album.get("play_count") else None,
        "language":        album.get("language"),
        "explicitContent": album.get("explicit_content") == "1",
        "url":             album.get("perma_url"),
        "songCount":       int(mi["song_count"]) if mi.get("song_count") else None,
        "artists": {
            "primary":  [build_artist_map(a) for a in artist_map.get("primary_artists", [])],
            "featured": [build_artist_map(a) for a in artist_map.get("featured_artists", [])],
            "all":      [build_artist_map(a) for a in artist_map.get("artists", [])],
        },
        "image": create_image_links(album.get("image", "")),
        "songs": [build_song(s) for s in songs_raw] if songs_raw else None,
    }


# ─── Playlist ─────────────────────────────────────────────────────────────────

def build_playlist(playlist: dict) -> dict:
    mi = playlist.get("more_info") or {}
    songs_raw = playlist.get("list") or []
    return {
        "id":              playlist.get("id"),
        "name":            playlist.get("title"),
        "description":     playlist.get("header_desc"),
        "type":            playlist.get("type"),
        "year":            int(playlist["year"]) if playlist.get("year") else None,
        "playCount":       int(playlist["play_count"]) if playlist.get("play_count") else None,
        "language":        playlist.get("language"),
        "explicitContent": playlist.get("explicit_content") == "1",
        "url":             playlist.get("perma_url"),
        "songCount":       len(songs_raw),
        "followerCount":   int(mi["follower_count"]) if mi.get("follower_count") else None,
        "lastUpdated":     mi.get("last_updated") or None,
        "username":        mi.get("username") or None,
        "firstname":       mi.get("firstname") or None,
        "lastname":        mi.get("lastname") or None,
        "image":           create_image_links(playlist.get("image", "")),
        "songs":           [build_song(s) for s in songs_raw],
    }


# ─── Artist ───────────────────────────────────────────────────────────────────

def build_artist(artist: dict) -> dict:
    def safe_json(val):
        if not val:
            return None
        try:
            return json.loads(val)
        except Exception:
            return val

    return {
        "id":                 artist.get("artistId") or artist.get("id"),
        "name":               artist.get("name"),
        "url":                (artist.get("urls") or {}).get("overview") or artist.get("perma_url"),
        "type":               artist.get("type"),
        "followerCount":      int(artist["follower_count"]) if artist.get("follower_count") else None,
        "fanCount":           artist.get("fan_count") or None,
        "isVerified":         artist.get("isVerified"),
        "dominantLanguage":   artist.get("dominantLanguage") or None,
        "dominantType":       artist.get("dominantType") or None,
        "bio":                safe_json(artist.get("bio")),
        "dob":                artist.get("dob") or None,
        "fb":                 artist.get("fb") or None,
        "twitter":            artist.get("twitter") or None,
        "wiki":               artist.get("wiki") or None,
        "availableLanguages": artist.get("availableLanguages") or None,
        "isRadioPresent":     artist.get("isRadioPresent"),
        "image":              create_image_links(artist.get("image", "")),
        "topSongs":   [build_song(s)   for s in (artist.get("topSongs")  or [])] or None,
        "topAlbums":  [build_album(a)  for a in (artist.get("topAlbums") or [])] or None,
        "singles":    [build_song(s)   for s in (artist.get("singles")   or [])] or None,
        "similarArtists": [
            {
                "id":             sa.get("id"),
                "name":           sa.get("name"),
                "url":            sa.get("perma_url"),
                "image":          create_image_links(sa.get("image_url", "")),
                "languages":      safe_json(sa.get("languages")),
                "wiki":           sa.get("wiki"),
                "dob":            sa.get("dob"),
                "fb":             sa.get("fb"),
                "twitter":        sa.get("twitter"),
                "isRadioPresent": sa.get("isRadioPresent"),
                "type":           sa.get("type"),
                "dominantType":   sa.get("dominantType"),
                "aka":            sa.get("aka"),
                "bio":            safe_json(sa.get("bio")),
                "similarArtists": safe_json(sa.get("similar")),
            }
            for sa in (artist.get("similarArtists") or [])
        ] or None,
    }


# ─── Search ───────────────────────────────────────────────────────────────────

def build_search_all(data: dict) -> dict:
    def _map_section(section, mapper):
        return {
            "results":  [mapper(i) for i in (section or {}).get("data", [])],
            "position": (section or {}).get("position"),
        }

    def _top_query_item(item):
        mi = item.get("more_info") or {}
        return {
            "id":              item.get("id"),
            "title":           item.get("title"),
            "image":           create_image_links(item.get("image", "")),
            "album":           mi.get("album"),
            "url":             item.get("perma_url"),
            "type":            item.get("type"),
            "language":        mi.get("language"),
            "description":     item.get("description"),
            "primaryArtists":  mi.get("primary_artists"),
            "singers":         mi.get("singers"),
        }

    def _song_item(item):
        mi = item.get("more_info") or {}
        return {
            "id":             item.get("id"),
            "title":          item.get("title"),
            "image":          create_image_links(item.get("image", "")),
            "album":          mi.get("album"),
            "url":            item.get("perma_url"),
            "type":           item.get("type"),
            "description":    item.get("description"),
            "primaryArtists": mi.get("primary_artists"),
            "singers":        mi.get("singers"),
            "language":       mi.get("language"),
        }

    def _album_item(item):
        mi = item.get("more_info") or {}
        return {
            "id":          item.get("id"),
            "title":       item.get("title"),
            "image":       create_image_links(item.get("image", "")),
            "artist":      mi.get("music"),
            "url":         item.get("perma_url"),
            "type":        item.get("type"),
            "description": item.get("description"),
            "year":        mi.get("year"),
            "songIds":     mi.get("song_pids"),
            "language":    mi.get("language"),
        }

    def _artist_item(item):
        return {
            "id":          item.get("id"),
            "title":       item.get("title"),
            "image":       create_image_links(item.get("image", "")),
            "type":        item.get("type"),
            "description": item.get("description"),
            "position":    item.get("position"),
        }

    def _playlist_item(item):
        mi = item.get("more_info") or {}
        return {
            "id":          item.get("id"),
            "title":       item.get("title"),
            "image":       create_image_links(item.get("image", "")),
            "url":         item.get("perma_url"),
            "type":        item.get("type"),
            "language":    mi.get("language"),
            "description": item.get("description"),
        }

    return {
        "topQuery":  _map_section(data.get("topquery"),  _top_query_item),
        "songs":     _map_section(data.get("songs"),     _song_item),
        "albums":    _map_section(data.get("albums"),    _album_item),
        "artists":   _map_section(data.get("artists"),  _artist_item),
        "playlists": _map_section(data.get("playlists"), _playlist_item),
    }


def build_search_songs(data: dict, limit: int) -> dict:
    return {
        "total":   data.get("total"),
        "start":   data.get("start"),
        "results": [build_song(s) for s in (data.get("results") or [])[:limit]],
    }


def build_search_albums(data: dict, limit: int) -> dict:
    results = []
    for item in (data.get("results") or [])[:limit]:
        mi = item.get("more_info") or {}
        am = mi.get("artistMap") or {}
        results.append({
            "id":              item.get("id"),
            "name":            item.get("title"),
            "description":     item.get("header_desc"),
            "url":             item.get("perma_url"),
            "year":            int(item["year"]) if item.get("year") else None,
            "type":            item.get("type"),
            "playCount":       int(item["play_count"]) if item.get("play_count") else None,
            "language":        item.get("language"),
            "explicitContent": item.get("explicit_content") == "1",
            "artists": {
                "primary":  [build_artist_map(a) for a in am.get("primary_artists", [])],
                "featured": [build_artist_map(a) for a in am.get("featured_artists", [])],
                "all":      [build_artist_map(a) for a in am.get("artists", [])],
            },
            "image": create_image_links(item.get("image", "")),
        })
    return {
        "total":   int(data.get("total", 0)),
        "start":   int(data.get("start", 0)),
        "results": results,
    }


def build_search_artists(data: dict, limit: int) -> dict:
    return {
        "total":   data.get("total"),
        "start":   data.get("start"),
        "results": [build_artist_map(a) for a in (data.get("results") or [])[:limit]],
    }


def build_search_playlists(data: dict, limit: int) -> dict:
    results = []
    for item in (data.get("results") or [])[:limit]:
        mi = item.get("more_info") or {}
        results.append({
            "id":              item.get("id"),
            "name":            item.get("title"),
            "type":            item.get("type"),
            "image":           create_image_links(item.get("image", "")),
            "url":             item.get("perma_url"),
            "songCount":       int(mi["song_count"]) if mi.get("song_count") else None,
            "language":        mi.get("language"),
            "explicitContent": item.get("explicit_content") == "1",
        })
    return {
        "total":   int(data.get("total", 0)),
        "start":   int(data.get("start", 0)),
        "results": results,
    }
