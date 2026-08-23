"""
helpers.py  |  Utility functions for the JioSaavn catalog layer
Credits: @ab_devs
"""

import base64
import html
import random
import re
import threading
import time
import requests
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.backends import default_backend

try:  # cryptography >= 43 moved TripleDES out of the main namespace
    from cryptography.hazmat.decrepit.ciphers.algorithms import TripleDES
except ImportError:  # pragma: no cover
    TripleDES = algorithms.TripleDES

# ─── DES decrypt key/iv ────────────────────────────────────────────────────────
_KEY = b"38346591"
_IV  = b"00000000"

QUALITIES = [
    ("12kbps",  "_12"),
    ("48kbps",  "_48"),
    ("96kbps",  "_96"),
    ("160kbps", "_160"),
    ("320kbps", "_320"),
]

IMAGE_QUALITIES = ["50x50", "150x150", "500x500"]

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 "
    "(KHTML, like Gecko) Version/17.0 Safari/605.1.15",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 "
    "(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
]

JIOSAAVN_API = "https://www.jiosaavn.com/api.php"


def clean_text(value):
    """Upstream titles arrive with HTML entities such as &quot; and &amp;."""
    if not isinstance(value, str):
        return value
    return html.unescape(value).strip()


def create_download_links(encrypted_media_url: str) -> list:
    """Decrypt JioSaavn media URL and return list of quality variants."""
    if not encrypted_media_url:
        return []
    try:
        encrypted = base64.b64decode(encrypted_media_url)
        # Pad to multiple of 8
        pad_len = (8 - len(encrypted) % 8) % 8
        if pad_len:
            encrypted += b"\x00" * pad_len
        cipher = Cipher(TripleDES(_KEY * 3), modes.ECB(), backend=default_backend())
        decryptor = cipher.decryptor()
        decrypted = (decryptor.update(encrypted) + decryptor.finalize()).decode("utf-8", errors="ignore").rstrip("\x00")
        return [
            {"quality": quality, "url": decrypted.replace("_96", suffix)}
            for quality, suffix in QUALITIES
        ]
    except Exception:
        return []


def create_image_links(link: str) -> list:
    """Return multiple image resolution URLs."""
    if not link:
        return []
    link = re.sub(r"^http://", "https://", link)
    return [
        {"quality": q, "url": re.sub(r"150x150|50x50", q, link)}
        for q in IMAGE_QUALITIES
    ]


def jiosaavn_fetch(endpoint: str, params: dict, ctx: str = "web6dot0") -> dict:
    """Generic JioSaavn internal API fetch."""
    base_params = {
        "__call":      endpoint,
        "_format":     "json",
        "_marker":     "0",
        "api_version": "4",
        "ctx":         ctx,
    }
    base_params.update(params)
    headers = {
        "Content-Type": "application/json",
        "User-Agent":   random.choice(USER_AGENTS),
    }
    resp = _session.get(JIOSAAVN_API, params=base_params, headers=headers, timeout=12)
    resp.raise_for_status()
    return resp.json()



# ---------------------------------------------------------------------------
# Connection pooling
# ---------------------------------------------------------------------------

_session = requests.Session()
_session.mount(
    "https://",
    requests.adapters.HTTPAdapter(pool_connections=16, pool_maxsize=32, max_retries=1),
)


# ---------------------------------------------------------------------------
# Tiny thread-safe TTL cache
#
# The recommendation engine fans out into a lot of upstream calls and many of
# them repeat across requests (charts, trending, artist pages, playlists).
# Caching them keeps the feed snappy and keeps us polite to the upstream API.
# ---------------------------------------------------------------------------

class TTLCache:
    def __init__(self, maxsize: int = 900):
        self._data = {}
        self._lock = threading.Lock()
        self._maxsize = maxsize

    def get(self, key):
        with self._lock:
            hit = self._data.get(key)
            if not hit:
                return None
            expires_at, value = hit
            if expires_at < time.time():
                self._data.pop(key, None)
                return None
            return value

    def set(self, key, value, ttl: float):
        with self._lock:
            if len(self._data) >= self._maxsize:
                # Drop the entries closest to expiry to make room.
                for stale_key in sorted(self._data, key=lambda k: self._data[k][0])[:120]:
                    self._data.pop(stale_key, None)
            self._data[key] = (time.time() + ttl, value)

    def stats(self):
        with self._lock:
            return {"entries": len(self._data), "maxsize": self._maxsize}


CACHE = TTLCache()


def jiosaavn_fetch_cached(endpoint: str, params: dict, ctx: str = "web6dot0", ttl: float = 600.0) -> dict:
    """jiosaavn_fetch with a TTL cache and soft failure.

    Returns {} instead of raising so a single flaky upstream call can never take
    down a whole recommendation feed.
    """
    key = (endpoint, ctx, tuple(sorted((str(k), str(v)) for k, v in params.items())))
    cached = CACHE.get(key)
    if cached is not None:
        return cached
    try:
        data = jiosaavn_fetch(endpoint, params, ctx=ctx) or {}
    except Exception:
        return {}
    CACHE.set(key, data, ttl)
    return data
