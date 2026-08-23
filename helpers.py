"""
helpers.py — Utility functions for JioSaavn API
Credits: @ab_devs
"""

import base64
import random
import re
import requests
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.backends import default_backend

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
        cipher = Cipher(algorithms.TripleDES(_KEY * 3), modes.ECB(), backend=default_backend())
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
    resp = requests.get(JIOSAAVN_API, params=base_params, headers=headers, timeout=10)
    resp.raise_for_status()
    return resp.json()
