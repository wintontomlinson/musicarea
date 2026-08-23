/* ==========================================================================
   MusicArea client
   Hash routed single page app: store, API client, player, views.
   ========================================================================== */

(() => {
  'use strict';

  /* ====================================================================== */
  /* Utilities                                                              */
  /* ====================================================================== */

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));

  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

  /** Phone layout. Kept as a media query so it matches the CSS breakpoint. */
  const isMobile = () => window.matchMedia('(max-width: 760px)').matches;

  function fmtTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
    const total = Math.floor(seconds);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return h
      ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      : `${m}:${String(s).padStart(2, '0')}`;
  }

  function fmtCount(value) {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return '';
    if (n >= 1e7) return `${(n / 1e7).toFixed(1)} Cr`;
    if (n >= 1e5) return `${(n / 1e5).toFixed(1)} L`;
    if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
    return String(n);
  }

  function plural(n, one, many) {
    return `${n} ${n === 1 ? one : many || `${one}s`}`;
  }

  /** Pick an image URL at or below the requested size. */
  /** Local placeholder, used when the catalogue has no real artwork. The
   *  upstream default images are provider branded, so they are filtered out
   *  server side and never reach here. */
  const ART_PLACEHOLDER = '/static/img/placeholder.svg';
  // Artwork is intentionally revalidated in bounded windows. That lets provider
  // cover changes land without giving every render a unique URL or defeating
  // image caching during a normal listening session.
  const ART_REVISION = Math.floor(Date.now() / (20 * 60 * 1000));

  function art(item, size = 500) {
    const list = item?.image;
    const source = typeof list === 'string'
      ? list
      : (Array.isArray(list) && list.length
        ? (list.find((i) => i.quality === `${size}x${size}`) || list[list.length - 1]).url
        : '');
    if (!source) return ART_PLACEHOLDER;
    if (!/^https?:\/\//i.test(source)) return source;
    const join = source.includes('?') ? '&' : '?';
    return `${source}${join}ma_art=${ART_REVISION}`;
  }

  /** Artist display line for a song. Skips lyricists and film cast. */
  const SKIP_ROLES = new Set(['lyricist', 'starring', 'actor', 'actors', 'cast']);

  function artistsOf(song) {
    const groups = song?.artists || {};
    // An artist can hold several credits at once (singer and lyricist, say), so
    // gather all of them and only drop people whose every credit is non-musical.
    const roles = new Map();
    (groups.all || []).forEach((a) => {
      if (!a?.id) return;
      if (!roles.has(a.id)) roles.set(a.id, new Set());
      roles.get(a.id).add((a.role || '').toLowerCase());
    });
    const isMusical = (id) => {
      const found = roles.get(id);
      if (!found) return true;
      return Array.from(found).some((role) => !SKIP_ROLES.has(role));
    };
    const out = [];
    const seen = new Set();
    const take = (bucket) => (groups[bucket] || []).forEach((a) => {
      if (!a?.id || seen.has(a.id)) return;
      if (!isMusical(a.id)) return;
      seen.add(a.id);
      out.push({ id: a.id, name: a.name || '' });
    });
    take('primary');
    take('featured');
    if (!out.length) take('all');
    return out;
  }

  function installArtworkFallbacks() {
    // One capturing listener covers lazy-loaded artwork across every route,
    // including later rendered shelves, queue rows and the full screen player.
    document.addEventListener('error', (event) => {
      const image = event.target;
      if (!(image instanceof HTMLImageElement) || image.dataset.artFallback === '1') return;
      image.dataset.artFallback = '1';
      image.src = ART_PLACEHOLDER;
      image.removeAttribute('srcset');
    }, true);
  }

  function artistLine(song) {
    const names = artistsOf(song).map((a) => a.name).filter(Boolean);
    if (names.length) return names.slice(0, 3).join(', ');
    return (song?.subtitle || '').split(' - ')[0] || 'Unknown artist';
  }

  /** Stable hue per track so the ambient wash feels tied to the music. */
  function hueOf(id) {
    let hash = 0;
    for (const ch of String(id || '')) hash = (hash * 31 + ch.charCodeAt(0)) % 100000;
    return hash % 360;
  }

  const QUALITY_ORDER = ['320kbps', '160kbps', '96kbps', '48kbps', '12kbps'];

  /** Resolve the stream to use, and report which rung it actually is.
   *  The two can differ: not every track carries every rung, so the badge shows
   *  what is really being served rather than what was asked for. */
  function pickStream(song, preferred) {
    const urls = song?.downloadUrl;
    if (!Array.isArray(urls) || !urls.length) return { url: '', quality: null };
    const byQuality = new Map(urls.map((u) => [u.quality, u.url]));
    const order = preferred
      ? [preferred, ...QUALITY_ORDER.filter((q) => q !== preferred)]
      : QUALITY_ORDER;
    for (const quality of order) {
      if (byQuality.get(quality)) return { url: byQuality.get(quality), quality };
    }
    const last = urls[urls.length - 1];
    return { url: last.url, quality: last.quality || null };
  }

  function streamUrl(song, preferred) {
    return pickStream(song, preferred).url;
  }

  /** Badge reflects the rung in use, and flags when it had to step down. */
  function showServedQuality(song, servedQuality = null) {
    const { quality } = pickStream(song, Store.prefs.quality);
    const served = servedQuality || quality;
    const tag = $('#qualityTag');
    if (!tag || !served) return;
    tag.textContent = served.replace('kbps', '');
    const steppedDown = served !== Store.prefs.quality;
    tag.classList.toggle('is-reduced', steppedDown);
    $('#quality').title = steppedDown
      ? `Playing at ${served.replace('kbps', ' kbps')}. This track is not available at ${Store.prefs.quality.replace('kbps', ' kbps')}.`
      : `Streaming at ${served.replace('kbps', ' kbps')}, the highest this track offers`;
  }

  /* ====================================================================== */
  /* Local store                                                            */
  /* ====================================================================== */

  const KEYS = {
    history: 'ma.history.v1',
    liked: 'ma.liked.v1',
    recent: 'ma.recent.v1',
    playlists: 'ma.playlists.v1',
    prefs: 'ma.prefs.v1',
    searches: 'ma.searches.v1',
  };

  const MAX_HISTORY = 400;
  const MAX_RECENT = 60;

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch { return fallback; }
  }

  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* quota */ }
  }

  const Store = {
    history: read(KEYS.history, []),
    liked: read(KEYS.liked, []),
    recent: read(KEYS.recent, []),
    playlists: read(KEYS.playlists, []),
    recentSearches: read(KEYS.searches, []),
    prefs: Object.assign(
      {
        volume: 0.85,
        muted: false,
        // 320kbps AAC is the highest the source offers. streamUrl() steps down
        // per track only when a given rung is missing.
        quality: '320kbps',
        repeat: 'off',
        shuffle: false,
        language: 'hindi',
        autoplay: true,
        // On by default: the next track rises over the tail of the current one.
        // Adjustable from 1 to 12 seconds, or off, in Settings.
        crossfade: 6,      // seconds, 0 disables the second deck entirely
        visualizer: true,
        sleepTimer: 0,     // minutes, 0 is off. Never persisted as active.
      },
      read(KEYS.prefs, {}),
    ),

    savePrefs() { write(KEYS.prefs, this.prefs); },

    /** Compact form of a song, which is what the recommender consumes. */
    slim(song) {
      return {
        id: song.id,
        name: song.name,
        language: song.language,
        year: song.year,
        playCount: song.playCount,
        artists: artistsOf(song).map((a) => ({ id: a.id, name: a.name })),
        album: { id: song.album?.id, name: song.album?.name },
        image: song.image,
        duration: song.duration,
      };
    },

    logEvent(song, event) {
      if (!song?.id) return;
      this.history.push(Object.assign(this.slim(song), { event, at: Date.now() }));
      if (this.history.length > MAX_HISTORY) {
        this.history = this.history.slice(-MAX_HISTORY);
      }
      write(KEYS.history, this.history);
      Feed.invalidate();
      Mixes.invalidate();
      Home.scheduleRefresh();
      renderTasteCard();
    },

    pushRecent(song) {
      if (!song?.id) return;
      this.recent = [this.slim(song), ...this.recent.filter((s) => s.id !== song.id)].slice(0, MAX_RECENT);
      write(KEYS.recent, this.recent);
      renderSidebarCounts();
    },

    isLiked(id) { return this.liked.some((s) => s.id === id); },

    toggleLike(song) {
      if (!song?.id) return false;
      const liked = this.isLiked(song.id);
      if (liked) {
        this.liked = this.liked.filter((s) => s.id !== song.id);
      } else {
        this.liked = [this.slim(song), ...this.liked];
        this.logEvent(song, 'like');
      }
      write(KEYS.liked, this.liked);
      renderSidebarCounts();
      return !liked;
    },

    createPlaylist(name) {
      const list = { id: `pl_${Date.now().toString(36)}`, name, songs: [], createdAt: Date.now() };
      this.playlists = [list, ...this.playlists];
      write(KEYS.playlists, this.playlists);
      renderPlaylistList();
      return list;
    },

    playlist(id) { return this.playlists.find((p) => p.id === id); },

    addToPlaylist(playlistId, song) {
      const list = this.playlist(playlistId);
      if (!list || list.songs.some((s) => s.id === song.id)) return false;
      list.songs.push(this.slim(song));
      write(KEYS.playlists, this.playlists);
      this.logEvent(song, 'playlist_add');
      renderPlaylistList();
      return true;
    },

    removeFromPlaylist(playlistId, songId) {
      const list = this.playlist(playlistId);
      if (!list) return;
      list.songs = list.songs.filter((s) => s.id !== songId);
      write(KEYS.playlists, this.playlists);
      renderPlaylistList();
    },

    deletePlaylist(id) {
      this.playlists = this.playlists.filter((p) => p.id !== id);
      write(KEYS.playlists, this.playlists);
      renderPlaylistList();
    },

    rememberSearch(query) {
      const q = (query || '').trim();
      if (!q) return;
      this.recentSearches = [q, ...this.recentSearches.filter((s) => s.toLowerCase() !== q.toLowerCase())]
        .slice(0, 10);
      write(KEYS.searches, this.recentSearches);
    },

    clearSearches() {
      this.recentSearches = [];
      write(KEYS.searches, []);
    },

    renamePlaylist(id, name) {
      const list = this.playlist(id);
      if (!list) return;
      list.name = name;
      write(KEYS.playlists, this.playlists);
      renderPlaylistList();
    },

    clearRecent() {
      this.recent = [];
      write(KEYS.recent, []);
      renderSidebarCounts();
    },

    clearHistory() {
      this.history = [];
      this.recent = [];
      write(KEYS.history, []);
      write(KEYS.recent, []);
      Feed.invalidate();
      renderTasteCard();
      renderSidebarCounts();
    },
  };

  /* ====================================================================== */
  /* API client                                                             */
  /* ====================================================================== */

  const API = {
    async get(path) {
      const res = await fetch(path, { headers: { Accept: 'application/json' } });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || body.success === false) {
        throw new Error(body.message || `Request failed (${res.status})`);
      }
      return body.data;
    },

    async post(path, payload) {
      const res = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload || {}),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || body.success === false) {
        throw new Error(body.message || `Request failed (${res.status})`);
      }
      return body.data;
    },

    feed(payload) { return this.post('/api/feed', payload); },
    browse(language) { return this.get(`/api/browse?language=${encodeURIComponent(language)}`); },
    radio(songId, limit = 40) { return this.get(`/api/radio/${encodeURIComponent(songId)}?limit=${limit}`); },
    artistRadio(id, limit = 40) { return this.get(`/api/artists/${encodeURIComponent(id)}/radio?limit=${limit}`); },
    mood(id, limit = 50) {
      // POSTed with history so the set is ordered against the listener's taste.
      return this.post(`/api/moods/${encodeURIComponent(id)}`, { history: Store.history, limit });
    },
    album(id, { refresh = false } = {}) {
      const suffix = refresh ? `&refresh=${Date.now()}` : '';
      return this.get(`/api/albums?id=${encodeURIComponent(id)}${suffix}`);
    },
    playlist(id, limit = 100) { return this.get(`/api/playlists?id=${encodeURIComponent(id)}&limit=${limit}`); },
    artist(id) { return this.get(`/api/artists/${encodeURIComponent(id)}?songCount=30&albumCount=20`); },
    songs(ids) { return this.get(`/api/songs?ids=${encodeURIComponent(ids.join(','))}`); },
    lyrics(id) { return this.get(`/api/songs/${encodeURIComponent(id)}/lyrics`); },
    similar(ids, limit = 16) { return this.post('/api/similar', { ids, limit }); },
    mixes(perMix = 24) { return this.post('/api/mixes', { history: Store.history, perMix }); },
    genres() { return this.get('/api/genres'); },
    suggest(query) { return this.get(`/api/search?query=${encodeURIComponent(query)}`); },
    searchSongs(q, limit = 30) { return this.get(`/api/search/songs?query=${encodeURIComponent(q)}&limit=${limit}`); },
    searchAlbums(q, limit = 16) { return this.get(`/api/search/albums?query=${encodeURIComponent(q)}&limit=${limit}`); },
    searchArtists(q, limit = 12) { return this.get(`/api/search/artists?query=${encodeURIComponent(q)}&limit=${limit}`); },
    searchPlaylists(q, limit = 16) { return this.get(`/api/search/playlists?query=${encodeURIComponent(q)}&limit=${limit}`); },
  };

  /** Personalised feed with a short lived cache so navigation stays instant. */
  const Feed = {
    cache: null,
    at: 0,
    ttl: 4 * 60 * 1000,
    inflight: null,

    invalidate() { this.cache = null; },

    async load(force = false) {
      if (!force && this.cache && Date.now() - this.at < this.ttl) return this.cache;
      if (this.inflight) return this.inflight;
      this.inflight = API.feed({ history: Store.history, limit: 24 })
        .then((data) => {
          this.cache = data;
          this.at = Date.now();
          // Reconcile the sidebar meter with the engine's own figure.
          renderTasteCard(data?.profile?.strength);
          return data;
        })
        .finally(() => { this.inflight = null; });
      return this.inflight;
    },
  };

  /** Generated mixes. Requested separately from the feed and cached, because a
   *  cold build needs several seconds and must not hold up the first paint. */
  const Mixes = {
    cache: null,
    at: 0,
    ttl: 10 * 60 * 1000,
    inflight: null,

    invalidate() { this.cache = null; },

    async load(force = false) {
      if (!force && this.cache && Date.now() - this.at < this.ttl) return this.cache;
      if (this.inflight) return this.inflight;
      this.inflight = API.mixes(24)
        .then((data) => {
          this.cache = data;
          this.at = Date.now();
          return data;
        })
        .finally(() => { this.inflight = null; });
      return this.inflight;
    },

    async find(id) {
      const data = await this.load();
      return (data?.mixes || []).find((m) => m.id === id) || null;
    },
  };

  /* ====================================================================== */
  /* Toasts                                                                 */
  /* ====================================================================== */

  const ICON_CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.6 16.6 5 12l1.4-1.4 3.2 3.2 8-8L19 7.2z"/></svg>';

  /* ====================================================================== */
  /* Dialog                                                                 */
  /* ====================================================================== */

  /** In-app replacement for prompt() and confirm().
   *  The native ones block the page, cannot be styled, and look out of place. */
  const Modal = {
    resolve: null,

    open({ title, text = '', value = null, okLabel = 'Save' }) {
      const box = $('#modal');
      $('#modalTitle').textContent = title;
      $('#modalText').textContent = text;
      $('#modalText').hidden = !text;
      const input = $('#modalInput');
      const wantsText = value !== null;
      input.hidden = !wantsText;
      input.value = wantsText ? value : '';
      $('#modalOk').textContent = okLabel;
      box.hidden = false;
      document.body.classList.add('is-modal');
      setTimeout(() => (wantsText ? input : $('#modalOk')).focus(), 30);
      return new Promise((resolve) => { this.resolve = resolve; });
    },

    close(result) {
      $('#modal').hidden = true;
      document.body.classList.remove('is-modal');
      const done = this.resolve;
      this.resolve = null;
      if (done) done(result);
    },

    submit() {
      const input = $('#modalInput');
      this.close(input.hidden ? true : (input.value.trim() || null));
    },
  };

  const askText = (title, value, okLabel = 'Save') =>
    Modal.open({ title, value, okLabel });
  const askConfirm = (title, text, okLabel = 'Delete') =>
    Modal.open({ title, text, value: null, okLabel });

  function toast(message, icon = ICON_CHECK) {
    const host = $('#toasts');
    const node = document.createElement('div');
    node.className = 'toast';
    node.innerHTML = `${icon}<span>${esc(message)}</span>`;
    host.appendChild(node);
    setTimeout(() => {
      node.classList.add('is-out');
      setTimeout(() => node.remove(), 240);
    }, 2600);
  }

  /* ====================================================================== */
  /* Registries: songs and playable lists                                   */
  /* ====================================================================== */

  const SONGS = new Map();
  const LISTS = new Map();
  let listSeq = 0;

  function remember(songs) {
    (songs || []).forEach((s) => s?.id && SONGS.set(s.id, s));
  }

  /** Fill in stream URLs for stored songs.
   *
   *  Store.slim() deliberately omits downloadUrl: the listening history is
   *  POSTed to the recommender on every feed request, and carrying five URLs per
   *  entry across hundreds of entries would bloat that payload badly.
   *
   *  The cost was that anything replayed from storage had no stream at all, so
   *  clicking a liked song, a recently played track or a track in a local
   *  playlist silently failed and autoplay wandered off to something unrelated.
   *  They are resolved here, at the point they are actually needed.
   */
  async function ensurePlayable(songs) {
    const list = (songs || []).filter((s) => s?.id);
    const missing = list.filter((s) => !s.downloadUrl?.length);
    if (!missing.length) return list;

    const ids = [...new Set(missing.map((s) => s.id))];
    const chunks = [];
    for (let i = 0; i < ids.length; i += 25) chunks.push(ids.slice(i, i + 25));

    const byId = new Map();
    const results = await Promise.allSettled(chunks.map((c) => API.songs(c)));
    results.forEach((r) => {
      if (r.status !== 'fulfilled') return;
      (r.value || []).forEach((song) => {
        if (song?.id) byId.set(song.id, song);
      });
    });
    if (byId.size) remember([...byId.values()]);
    return list.map((s) => (s.downloadUrl?.length ? s : (byId.get(s.id) || s)));
  }

  function registerList(songs, label) {
    const key = `l${++listSeq}`;
    remember(songs);
    LISTS.set(key, { songs: songs.filter((s) => s?.id), label: label || '' });
    return key;
  }

  /* ====================================================================== */
  /* Rendering primitives                                                   */
  /* ====================================================================== */

  const ICON_PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.2 19 12 8 18.8z"/></svg>';
  const ICON_HEART = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.7 4.6 13.6a4.9 4.9 0 0 1 7-6.9l.4.4.4-.4a4.9 4.9 0 0 1 7 6.9z"/></svg>';
  const ICON_MORE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 8a2 2 0 1 1 0-4 2 2 0 0 1 0 4m0 6a2 2 0 1 1 0-4 2 2 0 0 1 0 4m0 6a2 2 0 1 1 0-4 2 2 0 0 1 0 4"/></svg>';
  const ICON_SPARK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 9.2 8.6 2 9.3l5.4 4.8L5.8 21 12 17.3 18.2 21l-1.6-6.9L22 9.3l-7.2-.7z"/></svg>';
  const ICON_RADIO = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6m-5.7-2.5 1.4 1.4a6 6 0 0 0 0 8.2l-1.4 1.4a8 8 0 0 1 0-11M17.7 6.5a8 8 0 0 1 0 11l-1.4-1.4a6 6 0 0 0 0-8.2z"/></svg>';
  const ICON_SEEK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h2v14H4zm4 7 11-7v14z"/></svg>';
  const ICON_REMOVE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h6l1 2h4v2H4V5h4zm-3 6h12l-1 12H7zm3 2v8h1.5v-8zm4 0v8H15v-8z"/></svg>';
  const ICON_CLOCK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a9 9 0 1 0 9 9h-2a7 7 0 1 1-7-7v4l5-4-5-4zm-.9 5h1.6v4.6l3 1.8-.8 1.3-3.8-2.3z"/></svg>';
  const ICON_EDIT = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 17.2 16.4 4.8l2.8 2.8L6.8 20H4zM17.8 3.4 19.2 2 22 4.8l-1.4 1.4z"/></svg>';
  const ICON_VOLUME = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h3l4-4v14l-4-4H4zm11.5-1.3a5 5 0 0 1 0 8.6v-2A3 3 0 0 0 15.5 10z"/></svg>';

  function songCard(song, { badge } = {}) {
    const reason = song.recommendation?.reason;
    return `
      <article class="card" data-open-song="${esc(song.id)}">
        <div class="card__art">
          <img loading="lazy" decoding="async" src="${esc(art(song, 500))}" alt="">
          ${badge ? `<span class="card__badge">${esc(badge)}</span>` : ''}
          <button class="card__play" data-play-song="${esc(song.id)}" aria-label="Play ${esc(song.name)}">${ICON_PLAY}</button>
        </div>
        <div class="card__title">${esc(song.name)}</div>
        <div class="card__sub">${esc(artistLine(song))}</div>
        ${reason ? `<div style="margin-top:7px"><span class="reason-pill"><span>${esc(reason)}</span></span></div>` : ''}
      </article>`;
  }

  /** Mix tile: a four cover collage plus the mix name, so generated playlists
   *  read as their own kind of thing rather than as another album. */
  function mixCard(mix) {
    const covers = (mix.covers || []).slice(0, 4);
    const grid = covers.length >= 4
      ? covers.map((c) => `<img loading="lazy" decoding="async" src="${esc(art({ image: c }, 150))}" alt="">`).join('')
      : `<img loading="lazy" decoding="async" src="${esc(art(mix, 500))}" alt="" class="mix__solo">`;
    return `
      <article class="card mix" data-goto="#/mix/${esc(mix.id)}" style="--hue:${hueOf(mix.id)}">
        <div class="card__art mix__art">
          <div class="mix__grid">${grid}</div>
          <span class="mix__label">${esc(mix.name)}</span>
          <button class="card__play" data-play-mix="${esc(mix.id)}" aria-label="Play ${esc(mix.name)}">${ICON_PLAY}</button>
        </div>
        <div class="card__title">${esc(mix.name)}</div>
        <div class="card__sub">${esc(mix.subtitle || plural(mix.songCount, 'song'))}</div>
      </article>`;
  }

  function entityCard(item, kind) {
    const round = kind === 'artist';
    const route = kind === 'artist' ? 'artist' : kind === 'playlist' ? 'playlist' : 'album';
    const sub = item.subtitle || (item.songCount ? plural(item.songCount, 'song') : (item.year || ''));
    return `
      <article class="card ${round ? 'card--round' : ''}" data-goto="#/${route}/${esc(item.id)}">
        <div class="card__art">
          <img loading="lazy" decoding="async" src="${esc(art(item, 500))}" alt="">
          <button class="card__play" data-play-${esc(route)}="${esc(item.id)}" aria-label="Play ${esc(item.name)}">${ICON_PLAY}</button>
        </div>
        <div class="card__title">${esc(item.name)}</div>
        <div class="card__sub">${esc(sub)}</div>
      </article>`;
  }

  function trackRow(song, index, listKey, opts = {}) {
    const liked = Store.isLiked(song.id);
    const reason = song.recommendation?.reason;
    const current = Player.current?.id === song.id;
    return `
      <div class="track ${current ? 'is-current' : ''}" data-list="${esc(listKey)}" data-index="${index}" data-song="${esc(song.id)}">
        <div class="track__index">
          ${current
            ? '<span class="eq" aria-label="Now playing"><i></i><i></i><i></i><i></i></span>'
            : `<span class="track__index-num">${index + 1}</span><span class="track__index-play">${ICON_PLAY}</span>`}
        </div>
        <div class="track__main">
          ${opts.hideArt ? '' : `<img class="track__art" loading="lazy" decoding="async" src="${esc(art(song, 150))}" alt="">`}
          <div class="track__text">
            <div class="track__name">${esc(song.name)}</div>
            <div class="track__byline">
              ${song.explicitContent ? '<span title="Explicit" style="border:1px solid currentColor;border-radius:3px;padding:0 3px;font-size:9px">E</span>' : ''}
              <span>${esc(artistLine(song))}</span>
            </div>
          </div>
        </div>
        <div class="track__album">${esc(song.album?.name || '')}</div>
        <div class="track__reason">${reason ? `<span class="reason-pill"><span>${esc(reason)}</span></span>` : (song.playCount ? `<span class="track__album">${esc(fmtCount(song.playCount))} plays</span>` : '')}</div>
        <div class="track__dur">${fmtTime(song.duration)}</div>
        <div class="track__actions">
          <button class="icon-btn" data-like="${esc(song.id)}" aria-pressed="${liked}" aria-label="Like">${ICON_HEART}</button>
          ${opts.removeFrom
            ? `<button class="icon-btn icon-btn--danger" data-remove-from-list="${esc(opts.removeFrom)}" data-song="${esc(song.id)}" aria-label="Remove from this playlist" title="Remove from this playlist">${ICON_REMOVE}</button>`
            : ''}
          ${opts.unlike
            ? `<button class="icon-btn icon-btn--danger" data-unlike="${esc(song.id)}" aria-label="Remove from liked songs" title="Remove from liked songs">${ICON_REMOVE}</button>`
            : ''}
          <button class="icon-btn" data-menu="${esc(song.id)}" aria-label="More options">${ICON_MORE}</button>
        </div>
      </div>`;
  }

  function trackList(songs, { label, hideArt, removeFrom, unlike } = {}) {
    if (!songs?.length) return '';
    const key = registerList(songs, label);
    return `
      <div class="tracks" data-list-root="${key}">
        <div class="tracks__head">
          <span>#</span><span>Title</span><span>Album</span><span>Why</span><span>Time</span><span></span>
        </div>
        ${songs.map((song, i) => trackRow(song, i, key, { hideArt, removeFrom, unlike })).join('')}
      </div>`;
  }

  function shelf(row) {
    const items = row.items || [];
    if (!items.length) return '';
    let inner;
    if (row.kind === 'songs') {
      remember(items);
      const key = registerList(items, row.title);
      inner = items.map((song) => songCard(song)).join('');
      return section(row, `<div class="shelf" data-shelf-list="${key}">${inner}</div>`);
    }
    // Some upstream shelves mix standalone singles in with albums. A single's id
    // is a song id, so it must render as a playable song card rather than a link
    // to an album page that does not exist.
    const kind = row.kind === 'playlists' ? 'playlist' : row.kind === 'artists' ? 'artist' : 'album';
    const songs = items.filter((item) => item.type === 'song' && item.downloadUrl);
    const listKey = songs.length ? registerList(songs, row.title) : '';
    inner = items.map((item) => (
      item.type === 'song' && item.downloadUrl
        ? songCard(item)
        : entityCard(item, item.type === 'artist' ? 'artist' : item.type === 'playlist' ? 'playlist' : kind)
    )).join('');
    return section(row, `<div class="shelf"${listKey ? ` data-shelf-list="${listKey}"` : ''}>${inner}</div>`);
  }

  function section(row, inner) {
    const more = row.kind === 'songs' && (row.items || []).length > 4
      ? `<button class="text-btn" data-play-shelf="${esc(row.id || '')}">Play all</button>` : '';
    return `
      <section class="section" data-section="${esc(row.id || '')}">
        <div class="section__head">
          <div>
            <h2>${esc(row.title)}</h2>
            ${row.subtitle ? `<p>${esc(row.subtitle)}</p>` : ''}
          </div>
          <div class="section__head-actions">${more}</div>
        </div>
        ${inner}
      </section>`;
  }

  function skeletonShelf(title, count = 6) {
    return `
      <section class="section">
        <div class="section__head"><div><h2>${esc(title)}</h2></div></div>
        <div class="shelf">
          ${Array.from({ length: count }, () => `
            <div class="card">
              <div class="skel skel-card__art"></div>
              <div class="skel skel-line"></div>
              <div class="skel skel-line skel-line--sm"></div>
            </div>`).join('')}
        </div>
      </section>`;
  }

  function emptyState(title, message, actionHtml = '') {
    return `
      <div class="empty">
        <div class="empty__icon">${ICON_SPARK}</div>
        <h2>${esc(title)}</h2>
        <p>${esc(message)}</p>
        ${actionHtml}
      </div>`;
  }

  /* ====================================================================== */
  /* Player                                                                 */
  /* ====================================================================== */

  /* Two decks. `audio` always points at the deck that owns the UI state; the
     other one is idle, or fading in during a crossfade. Because `audio` is a
     mutable binding, every existing `audio.x` reference follows the swap. */
  const DECKS = [$('#audioA'), $('#audioB')];
  let audio = DECKS[0];
  const idleDeck = () => (audio === DECKS[0] ? DECKS[1] : DECKS[0]);

  /** Target playback gain, respecting mute. Fades scale against this. */
  const gain = () => (Store.prefs.muted ? 0 : Store.prefs.volume);

  const Player = {
    queue: [],
    order: [],
    pos: -1,
    current: null,
    playedRatio: 0,
    loggedPlay: false,
    autoplayPending: false,
    seeking: false,
    playRequest: 0,
    servedQuality: null,
    crossfadeStarting: false,
    handoffGeneration: 0,
    handoffTimer: 0,

    fadeRaf: 0,
    fading: false,

    init() {
      DECKS.forEach((deck) => {
        deck.volume = gain();
        deck.muted = !!Store.prefs.muted;
      });
      $('#volume').value = Math.round(Store.prefs.volume * 100);
      setVolumeFill(Store.prefs.volume * 100);
      $('#muteBtn').classList.toggle('is-muted', !!Store.prefs.muted);
      $('#qualityTag').textContent = Store.prefs.quality.replace('kbps', '');
      syncTransport();

      // Both decks are wired, but only the active one is allowed to drive the
      // UI. A deck that is fading out must not repaint state or advance tracks.
      DECKS.forEach((deck) => {
        const isActive = () => deck === audio && deck.dataset.retiring !== '1';

        deck.addEventListener('loadedmetadata', () => {
          if (!isActive()) return;
          const total = fmtTime(deck.duration || this.current?.duration || 0);
          $$('.js-total').forEach((el) => { el.textContent = total; });
        });
        deck.addEventListener('timeupdate', () => { if (isActive()) this.onTime(); });
        deck.addEventListener('ended', () => { if (isActive()) this.onEnded(); });
        deck.addEventListener('play', () => { if (isActive()) setPlayerState('playing'); });
        deck.addEventListener('pause', () => {
          if (isActive() && !deck.ended) setPlayerState('paused');
        });
        deck.addEventListener('waiting', () => { if (isActive()) setPlayerState('loading'); });
        deck.addEventListener('playing', () => { if (isActive()) setPlayerState('playing'); });
        deck.addEventListener('error', () => { if (isActive()) this.onError(); });
      });
    },

    /* ---- Crossfade ------------------------------------------------------ */

    /** Equal power fade. sin/cos keeps perceived loudness flat across the blend,
     *  where a linear ramp audibly dips in the middle. */
    runFade(fromDeck, toDeck, seconds, onDone) {
      cancelAnimationFrame(this.fadeRaf);
      const target = gain();
      const startFrom = fromDeck ? fromDeck.volume : 0;
      const started = performance.now();
      const duration = Math.max(0.05, seconds) * 1000;
      this.fading = true;

      const step = () => {
        const p = clamp((performance.now() - started) / duration, 0, 1);
        if (toDeck) toDeck.volume = clamp(target * Math.sin((p * Math.PI) / 2), 0, 1);
        if (fromDeck) fromDeck.volume = clamp(startFrom * Math.cos((p * Math.PI) / 2), 0, 1);
        if (p < 1) {
          this.fadeRaf = requestAnimationFrame(step);
          return;
        }
        this.fading = false;
        if (toDeck) toDeck.volume = target;
        if (onDone) onDone();
      };
      this.fadeRaf = requestAnimationFrame(step);
    },

    /** Buffer the upcoming track on the idle deck ahead of time.
     *
     *  Without this the next track is only fetched at the instant the blend
     *  starts, so on anything slower than a fast connection the incoming side
     *  of the crossfade begins silent and leaves a hole in the middle of it.
     *  It also removes the gap between tracks when crossfade is switched off.
     */
    preloadNext() {
      if (this.fading) return;                 // idle deck is the retiring one
      const nextPos = this.pos + 1;
      if (nextPos >= this.order.length) return;
      const song = this.queue[this.order[nextPos]];
      if (!song) return;
      const url = streamUrl(song, Store.prefs.quality);
      if (!url) return;

      const deck = idleDeck();
      if (deck.dataset.readyFor === song.id && deck.readyState >= 2) return;
      deck.dataset.readyFor = song.id;
      deck.volume = 0;                         // never audible until we fade it in
      deck.muted = !!Store.prefs.muted;
      deck.src = url;
      try { deck.load(); } catch { /* nothing to abort */ }
    },

    /** Cancel a pending handoff so a late play promise cannot take ownership. */
    cancelHandoff() {
      this.handoffGeneration += 1;
      if (this.handoffTimer) window.clearTimeout(this.handoffTimer);
      this.handoffTimer = 0;
      this.crossfadeStarting = false;
      DECKS.forEach((deck) => { deck.dataset.retiring = ''; });
    },

    /** Start `orderPos` on the idle deck and blend the two over `seconds`. */
    async crossfadeTo(orderPos, seconds) {
      if (this.fading || this.crossfadeStarting) return false;
      if (orderPos < 0 || orderPos >= this.order.length) return false;
      const song = this.queue[this.order[orderPos]];
      const selectedStream = song && pickStream(song, Store.prefs.quality);
      const url = selectedStream?.url;
      if (!url) return false;

      const handoff = ++this.handoffGeneration;
      this.crossfadeStarting = true;
      const clearRecovery = () => {
        if (this.handoffGeneration !== handoff) return false;
        if (this.handoffTimer) window.clearTimeout(this.handoffTimer);
        this.handoffTimer = 0;
        return true;
      };

      const outgoing = audio;
      const incoming = idleDeck();
      const outgoingSong = this.current;
      const outgoingRatio = this.playedRatio;
      const duration = Number.isFinite(outgoing.duration)
        ? outgoing.duration
        : (outgoingSong?.duration || 0);
      const remaining = Math.max(0, duration - outgoing.currentTime);

      outgoing.dataset.retiring = '1';
      incoming.dataset.retiring = '';
      // Reuse the preloaded buffer. Reassigning src would throw it away and
      // reintroduce the silent start this preloading exists to prevent.
      if (incoming.dataset.readyFor !== song.id || !incoming.getAttribute('src')) {
        incoming.src = url;
      }
      try { incoming.currentTime = 0; } catch { /* not seekable yet */ }
      incoming.volume = 0;
      incoming.muted = !!Store.prefs.muted;

      // The retiring deck's ordinary ended handler is intentionally muted, so
      // recovery belongs to this handoff. Give the incoming play request a
      // short grace period after the outgoing track should have ended, then
      // hard-load the next track if it still has not started.
      // Keep manual skips responsive too: unlike automatic fades they can begin
      // well before the end of a long track, so the recovery cannot wait for
      // the entire remaining duration.
      const recoveryDelay = Math.min(2500, Math.max(350, Math.ceil(remaining * 1000) + 300));
      this.handoffTimer = window.setTimeout(() => {
        if (this.handoffGeneration === handoff && this.crossfadeStarting) {
          this.load(orderPos);
        }
      }, recoveryDelay);

      try {
        await incoming.play();
      } catch {
        if (!clearRecovery()) return false;
        // Autoplay refused the second deck: restore the current deck. If it
        // has already finished, use the same hard handoff as timeout recovery.
        outgoing.dataset.retiring = '';
        this.crossfadeStarting = false;
        if (outgoing.ended) this.load(orderPos);
        return false;
      }

      // Explicit navigation or timeout recovery may have loaded another track
      // while the incoming play promise was resolving.
      if (!clearRecovery()) {
        incoming.pause();
        return false;
      }
      this.crossfadeStarting = false;
      // Hand the UI over immediately so the now playing view matches what is
      // becoming audible.
      audio = incoming;
      this.pos = orderPos;
      this.current = song;
      this.servedQuality = selectedStream.quality;
      this.playedRatio = 0;
      this.loggedPlay = false;
      paintNowPlaying(song);
      Store.pushRecent(song);
      updateMediaSession(song);
      setPlayerState('playing');
      renderQueue();
      markCurrentRows();
      Viz.attach(incoming);

      // The source can become ready a moment after the outgoing track reaches
      // its end. In that case there is nothing left to blend, so make the
      // already-playing incoming deck audible immediately rather than fading
      // it in from silence for the full crossfade duration.
      if (outgoing.ended) {
        incoming.volume = gain();
        outgoing.pause();
        outgoing.removeAttribute('src');
        outgoing.dataset.readyFor = '';
        outgoing.load();
        outgoing.dataset.retiring = '';
        outgoing.volume = gain();
        if (outgoingSong) {
          Store.logEvent(outgoingSong, outgoingRatio > 0.9 ? 'complete' : 'play');
        }
        this.preloadNext();
        this.topUpIfNeeded();
        return true;
      }

      this.runFade(outgoing, incoming, seconds, () => {
        if (this.handoffGeneration !== handoff) return;
        outgoing.pause();
        outgoing.removeAttribute('src');
        outgoing.dataset.readyFor = '';
        outgoing.load();
        outgoing.dataset.retiring = '';
        outgoing.volume = gain();
        if (outgoingSong) {
          Store.logEvent(outgoingSong, outgoingRatio > 0.9 ? 'complete' : 'play');
        }
        // The freed deck becomes the next preload target.
        this.preloadNext();
      });

      this.topUpIfNeeded();
      return true;
    },

    /** Play a list of songs starting at an index. */
    async play(songs, index = 0, meta = {}) {
      // Resolving stored tracks is asynchronous. A request counter keeps an
      // earlier slow click from replacing the track the listener chose later.
      const request = ++this.playRequest;
      // Remember which track was actually clicked: resolving and filtering can
      // shift positions, and starting the wrong song is worse than a delay.
      const wanted = (songs || [])[index];
      const resolved = await ensurePlayable(songs);
      if (request !== this.playRequest) return;
      const playable = resolved.filter((s) => s?.id && s.downloadUrl?.length);
      if (!playable.length) {
        toast('Nothing playable in there');
        return;
      }
      remember(playable);
      this.queue = playable;
      this.contextLabel = meta.label || '';

      let start = wanted ? playable.findIndex((s) => s.id === wanted.id) : 0;
      if (start < 0) start = 0;
      this.rebuildOrder(start);
      const pos = this.order.indexOf(start);
      await this.load(pos >= 0 ? pos : 0, true);
      renderQueue();
    },

    rebuildOrder(startIndex = 0) {
      const indices = this.queue.map((_, i) => i);
      if (Store.prefs.shuffle) {
        // Fisher-Yates over everything except the track being started, which
        // stays first so shuffling never changes what you just clicked.
        const rest = indices.filter((i) => i !== startIndex);
        for (let i = rest.length - 1; i > 0; i -= 1) {
          const j = Math.floor(Math.random() * (i + 1));
          [rest[i], rest[j]] = [rest[j], rest[i]];
        }
        this.order = startIndex >= 0 ? [startIndex, ...rest] : rest;
      } else {
        this.order = indices;
      }
    },

    async load(orderPos, autoplay = true) {
      if (orderPos < 0 || orderPos >= this.order.length) return;

      // Abandon any blend in progress and silence the other deck, otherwise a
      // retiring track keeps playing underneath the new one.
      this.cancelHandoff();
      cancelAnimationFrame(this.fadeRaf);
      this.fading = false;
      const other = idleDeck();
      other.pause();
      other.removeAttribute('src');
      other.dataset.retiring = '';
      audio.dataset.retiring = '';
      audio.volume = gain();

      this.pos = orderPos;
      const song = this.queue[this.order[orderPos]];
      if (!song) return;

      this.current = song;
      this.playedRatio = 0;
      this.loggedPlay = false;

      const selectedStream = pickStream(song, Store.prefs.quality);
      const url = selectedStream.url;
      this.servedQuality = selectedStream.quality;
      if (!url) {
        toast('That track has no playable stream');
        return this.next();
      }

      setPlayerState('loading');
      audio.src = url;
      paintNowPlaying(song);
      Store.pushRecent(song);
      renderQueue();
      markCurrentRows();

      if (autoplay) {
        try {
          await audio.play();
        } catch {
          setPlayerState('paused');
        }
      }
      updateMediaSession(song);
      await this.topUpIfNeeded();
      // Buffer whatever comes next straight away. This is what removes the gap
      // between tracks when crossfade is switched off.
      this.preloadNext();
    },

    toggle() {
      if (!this.current) {
        // Nothing loaded yet: start the best thing we know about.
        const first = LISTS.values().next().value;
        if (first?.songs?.length) this.play(first.songs, 0, { label: first.label });
        return;
      }
      if (audio.paused) audio.play().catch(() => setPlayerState('paused'));
      else audio.pause();
    },

    next(userInitiated = false) {
      if (userInitiated && this.current && this.playedRatio < 0.25) {
        Store.logEvent(this.current, 'skip');
      }
      if (Store.prefs.repeat === 'one' && !userInitiated) {
        audio.currentTime = 0;
        audio.play().catch(() => {});
        return;
      }
      const nextPos = this.pos + 1;
      if (nextPos < this.order.length) {
        // An explicit skip always wins over an in-flight automatic handoff.
        // load() invalidates the transition token, silences the other deck,
        // and prevents a late incoming play promise from reclaiming the UI.
        if (userInitiated && (this.crossfadeStarting || this.fading)) {
          return this.load(nextPos);
        }
        // A manual skip gets a short blend rather than the full crossfade
        // length, so the button still feels immediate. With crossfade off it
        // becomes a 60ms handover: inaudible, but it uses the already buffered
        // deck, which is what makes the transition gapless instead of stalling
        // while the next track loads.
        const fade = Store.prefs.crossfade > 0
          ? Math.min(Store.prefs.crossfade, 1.2)
          : 0.06;
        const song = this.queue[this.order[nextPos]];
        const idle = idleDeck();
        const buffered = song && idle.dataset.readyFor === song.id && idle.readyState >= 2;
        if (buffered || (Store.prefs.crossfade > 0 && !audio.paused)) {
          return this.crossfadeTo(nextPos, fade);
        }
        return this.load(nextPos);
      }
      if (Store.prefs.repeat === 'all' && this.order.length) return this.load(0);
      if (Store.prefs.autoplay) return this.extendWithRadio();
      setPlayerState('paused');
    },

    prev() {
      if (audio.currentTime > 4) {
        audio.currentTime = 0;
        return;
      }
      if (this.pos > 0) return this.load(this.pos - 1);
      audio.currentTime = 0;
    },

    async enqueue(song, { next = false } = {}) {
      if (!song?.id) return;
      if (!song.downloadUrl?.length) {
        // Same resolution path as play(): a queued library entry has no stream.
        [song] = await ensurePlayable([song]);
        if (!song?.downloadUrl?.length) {
          toast('That track could not be loaded');
          return;
        }
      }
      remember([song]);
      if (!this.queue.length) return this.play([song], 0);
      if (next) {
        const insertAt = this.order[this.pos] + 1;
        this.queue.splice(insertAt, 0, song);
        // Indices after the insertion point shift by one.
        this.order = this.order.map((i) => (i >= insertAt ? i + 1 : i));
        this.order.splice(this.pos + 1, 0, insertAt);
      } else {
        this.queue.push(song);
        this.order.push(this.queue.length - 1);
      }
      Store.logEvent(song, 'queue');
      renderQueue();
    },

    removeFromQueue(orderPos) {
      if (orderPos === this.pos) return;
      const queueIndex = this.order[orderPos];
      this.order.splice(orderPos, 1);
      this.queue.splice(queueIndex, 1);
      this.order = this.order.map((i) => (i > queueIndex ? i - 1 : i));
      if (orderPos < this.pos) this.pos -= 1;
      renderQueue();
    },

    clearUpcoming() {
      this.order = this.order.slice(0, this.pos + 1);
      renderQueue();
      toast('Cleared what was coming up');
    },

    /** Keep the station alive by appending algorithmic picks near the end. */
    async topUpIfNeeded() {
      if (!Store.prefs.autoplay) return;
      const remaining = this.order.length - this.pos - 1;
      if (remaining > 2 || this.autoplayPending || !this.current) return;
      this.autoplayPending = true;
      try {
        const station = await API.radio(this.current.id, 20);
        const known = new Set(this.queue.map((s) => s.id));
        const fresh = (station.items || []).filter((s) => !known.has(s.id));
        if (fresh.length) {
          remember(fresh);
          fresh.forEach((song) => {
            this.queue.push(song);
            this.order.push(this.queue.length - 1);
          });
          renderQueue();
          // A track now exists after the current one, so it can be buffered.
          this.preloadNext();
        }
      } catch { /* offline or upstream hiccup: silent */ } finally {
        this.autoplayPending = false;
      }
    },

    async extendWithRadio() {
      if (!this.current) return;
      setPlayerState('loading');
      await this.topUpIfNeeded();
      if (this.pos + 1 < this.order.length) return this.load(this.pos + 1);
      setPlayerState('paused');
      toast('Reached the end of the queue');
    },

    onTime() {
      const duration = audio.duration || this.current?.duration || 0;
      if (!duration) return;
      const ratio = clamp(audio.currentTime / duration, 0, 1);
      this.playedRatio = ratio;
      if (!this.seeking) paintProgress(ratio);
      $$('.js-now').forEach((el) => { el.textContent = fmtTime(audio.currentTime); });

      // A play only counts once we are past the intro.
      if (!this.loggedPlay && audio.currentTime > 12) {
        this.loggedPlay = true;
        Store.logEvent(this.current, 'play');
      }
      if (ratio > 0.82 && this.pos + 2 >= this.order.length) this.topUpIfNeeded();

      const seconds = Store.prefs.crossfade;
      const remaining = duration - audio.currentTime;

      // Get the next track buffered well before it is needed, so the blend
      // starts from audio that is already in memory.
      if (!this.fading && remaining <= seconds + 15) this.preloadNext();

      // Start a fraction early. `audio.play()` can wait for the incoming deck's
      // final buffer frame, and starting at the exact boundary made short or
      // slow streams finish before their successor became audible. The tiny
      // lead keeps a real overlap while still preserving the configured fade.
      const earlyStart = 0.85;
      if (seconds > 0 && !this.fading && !this.crossfadeStarting
          && Store.prefs.repeat !== 'one' && this.pos + 1 < this.order.length) {
        if (remaining <= seconds + earlyStart && remaining > 0.2) {
          const fade = Math.min(seconds, Math.max(0.35, remaining - 0.15));
          this.crossfadeTo(this.pos + 1, fade);
        }
      }
    },

    onEnded() {
      if (Store.prefs.repeat === 'one') {
        // A deliberate repeat is a stronger taste signal than a normal finish.
        if (this.current) Store.logEvent(this.current, 'repeat');
        audio.currentTime = 0;
        audio.play().catch(() => {});
        return;
      }
      if (this.current) {
        Store.logEvent(this.current, this.playedRatio > 0.9 ? 'complete' : 'play');
      }
      this.next();
    },

    onError() {
      if (!this.current) return;
      // Fall back to a lower bitrate before giving up on the track.
      const current = audio.src;
      for (const quality of QUALITY_ORDER) {
        const selectedStream = pickStream(this.current, quality);
        if (selectedStream.url && selectedStream.url !== current) {
          this.servedQuality = selectedStream.quality;
          audio.src = selectedStream.url;
          audio.play().catch(() => {});
          showServedQuality(this.current, selectedStream.quality);
          return;
        }
      }
      toast(`Could not play ${this.current.name}`);
      this.next();
    },

    seekToRatio(ratio) {
      const duration = audio.duration || this.current?.duration || 0;
      if (!duration) return;
      audio.currentTime = clamp(ratio, 0, 1) * duration;
    },

    /** Seek by a number of seconds, clamped inside the track. */
    seekBy(seconds) {
      const duration = audio.duration || this.current?.duration || 0;
      if (!duration) return;
      audio.currentTime = clamp(audio.currentTime + seconds, 0, Math.max(0, duration - 0.25));
      toast(`${seconds > 0 ? 'Forward' : 'Back'} ${Math.abs(seconds)}s`, ICON_SEEK);
    },
  };

  /** Reason pills keep their label in a child span so it can ellipsize. */
  function setPill(pill, text) {
    if (!pill) return;
    pill.hidden = !text;
    if (text) pill.firstElementChild.textContent = text;
  }

  function setPlayerState(state) {
    // Both the bar and the full screen overlay read this attribute, so their
    // play/pause icons and spinners can never disagree.
    $('#player').dataset.state = state;
    $('#np').dataset.state = state;
    const playing = state === 'playing';
    $$('[data-pa="toggle"]').forEach((btn) => {
      btn.setAttribute('aria-label', playing ? 'Pause' : 'Play');
      btn.title = playing ? 'Pause' : 'Play';
    });
    document.body.classList.toggle('is-paused', !playing);
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = playing ? 'playing' : 'paused';
    }
  }

  /** Reflect shuffle, repeat and like onto every copy of those controls. */
  function syncTransport() {
    $$('.js-shuffle').forEach((btn) => {
      btn.classList.toggle('is-on', !!Store.prefs.shuffle);
      btn.setAttribute('aria-pressed', String(!!Store.prefs.shuffle));
    });
    $$('.js-repeat').forEach((btn) => { btn.dataset.mode = Store.prefs.repeat; });
    const liked = Player.current ? Store.isLiked(Player.current.id) : false;
    $$('.js-like').forEach((btn) => btn.setAttribute('aria-pressed', String(liked)));
  }

  function setVolumeFill(percent) {
    $('#volume').style.setProperty('--vol', `${percent}%`);
  }

  /** Paint the seek position onto every progress bar. */
  function paintProgress(ratio) {
    const r = clamp(ratio, 0, 1);
    const pct = `${r * 100}%`;
    $$('.js-scrub').forEach((bar) => {
      const fill = $('.js-fill', bar);
      const knob = $('.player__progress-knob', bar);
      // scaleX rather than width: a transform is composited without relayout.
      if (fill) fill.style.transform = `scaleX(${r})`;
      if (knob) knob.style.left = pct;
      bar.setAttribute('aria-valuenow', String(Math.round(r * 100)));
    });
  }

  /** Single place that owns volume, so the slider, the keys and the mute button
   *  can never disagree about the current level. */
  function applyVolume(value, { announce = false } = {}) {
    const level = clamp(value, 0, 1);
    Store.prefs.volume = level;
    Store.prefs.muted = level === 0;
    Store.savePrefs();
    DECKS.forEach((deck) => { deck.muted = Store.prefs.muted; });
    // Mid-crossfade the ramp owns the gain, so only retarget the active deck.
    if (!Player.fading) audio.volume = level;
    $('#volume').value = Math.round(level * 100);
    setVolumeFill(level * 100);
    $('#muteBtn').classList.toggle('is-muted', Store.prefs.muted);
    if (announce) {
      toast(level === 0 ? 'Muted' : `Volume ${Math.round(level * 100)}%`, ICON_VOLUME);
    }
  }

  function nudgeVolume(delta) {
    applyVolume((Store.prefs.muted ? 0 : Store.prefs.volume) + delta, { announce: true });
  }

  function setArtwork(image, source, alt = '') {
    if (!image) return;
    delete image.dataset.artFallback;
    image.src = source || ART_PLACEHOLDER;
    image.alt = alt;
  }

  function paintNowPlaying(song) {
    const cover = art(song, 500);
    setArtwork($('#playerImg'), cover, song.name || '');
    $('#playerTitle').textContent = song.name || '';
    $('#playerTitle').href = song.album?.id ? `#/album/${song.album.id}` : '#/home';
    $('#playerArtist').textContent = artistLine(song);
    $$('.js-like').forEach((b) => b.setAttribute('aria-pressed', String(Store.isLiked(song.id))));

    const reason = song.recommendation?.reason;
    setPill($('#reasonPill'), reason);

    setArtwork($('#npImg'), cover, song.name || '');
    $('#npTitle').textContent = song.name || '';
    $('#npArtist').textContent = artistLine(song);
    setPill($('#npReason'), reason);

    document.documentElement.style.setProperty('--hue', String(hueOf(song.id)));
    document.title = `${song.name} · ${artistLine(song)} | MusicArea`;
    showServedQuality(song, Player.servedQuality);
    if (!$('#np').hidden) renderNpPanel();
  }

  function updateMediaSession(song) {
    if (!('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: song.name || '',
        artist: artistLine(song),
        album: song.album?.name || 'MusicArea',
        artwork: (song.image || []).map((i) => ({
          src: i.url,
          sizes: i.quality,
          type: 'image/jpeg',
        })),
      });
      navigator.mediaSession.setActionHandler('play', () => Player.toggle());
      navigator.mediaSession.setActionHandler('pause', () => Player.toggle());
      navigator.mediaSession.setActionHandler('previoustrack', () => Player.prev());
      navigator.mediaSession.setActionHandler('nexttrack', () => Player.next(true));
    } catch { /* unsupported */ }
  }

  function markCurrentRows() {
    $$('.track').forEach((row) => {
      const isCurrent = row.dataset.song === Player.current?.id;
      if (isCurrent === row.classList.contains('is-current')) return;
      row.classList.toggle('is-current', isCurrent);
      const cell = $('.track__index', row);
      if (!cell) return;
      cell.innerHTML = isCurrent
        ? '<span class="eq" aria-label="Now playing"><i></i><i></i><i></i><i></i></span>'
        : `<span class="track__index-num">${Number(row.dataset.index) + 1}</span><span class="track__index-play">${ICON_PLAY}</span>`;
    });
    $$('.qrow').forEach((row) => {
      row.classList.toggle('is-current', row.dataset.song === Player.current?.id);
    });
  }

  /* ====================================================================== */
  /* Queue drawer                                                           */
  /* ====================================================================== */

  function renderQueue() {
    const body = $('#queueBody');
    if (!body) return;
    if (!Player.queue.length) {
      body.innerHTML = '<div class="empty" style="padding:40px 16px"><p>Your queue is empty. Play something and the algorithm keeps it topped up.</p></div>';
      return;
    }
    const rows = (start, end) => Player.order.slice(start, end).map((queueIndex, offset) => {
      const song = Player.queue[queueIndex];
      const orderPos = start + offset;
      const current = orderPos === Player.pos;
      return `
        <div class="qrow ${current ? 'is-current' : ''}" data-queue-pos="${orderPos}" data-song="${esc(song.id)}">
          <img loading="lazy" decoding="async" src="${esc(art(song, 150))}" alt="">
          <div class="qrow__text">
            <strong>${esc(song.name)}</strong>
            <small>${esc(artistLine(song))}</small>
          </div>
          ${current ? '<span class="eq"><i></i><i></i><i></i><i></i></span>'
            : `<button class="icon-btn qrow__drop" data-queue-remove="${orderPos}" aria-label="Remove from queue">
                 <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.4 6 6 7.4 10.6 12 6 16.6 7.4 18 12 13.4 16.6 18 18 16.6 13.4 12 18 7.4 16.6 6 12 10.6z"/></svg>
               </button>`}
        </div>`;
    }).join('');

    body.innerHTML = `
      <div class="drawer__group">Now playing</div>
      ${rows(Player.pos, Player.pos + 1)}
      ${Player.pos + 1 < Player.order.length ? `<div class="drawer__group">Next up${Player.contextLabel ? ` from ${esc(Player.contextLabel)}` : ''}</div>${rows(Player.pos + 1, Player.order.length)}` : ''}`;
  }

  /* ====================================================================== */
  /* Now playing overlay                                                    */
  /* ====================================================================== */

  let npTab = 'queue';

  function openNp() {
    $('#np').hidden = false;
    document.body.style.overflow = 'hidden';
    renderNpViz();
    renderNpPanel();
    if (Store.prefs.visualizer) Viz.start();
  }

  function closeNp() {
    $('#np').hidden = true;
    document.body.style.overflow = '';
    Viz.stop();
  }

  function renderNpViz() {
    const host = $('#npViz');
    if (host.children.length) return;
    host.innerHTML = Array.from({ length: 28 }, (_, i) =>
      `<i style="animation-delay:-${(i * 90) % 1100}ms"></i>`).join('');
  }

  async function renderNpPanel() {
    const panel = $('#npPanel');
    const song = Player.current;

    if (npTab === 'queue') {
      if (!Player.queue.length) {
        panel.innerHTML = '<p class="panel__note">Nothing queued yet.</p>';
        return;
      }
      panel.innerHTML = Player.order.map((queueIndex, orderPos) => {
        const item = Player.queue[queueIndex];
        return `
          <div class="qrow ${orderPos === Player.pos ? 'is-current' : ''}" data-queue-pos="${orderPos}" data-song="${esc(item.id)}">
            <img loading="lazy" decoding="async" src="${esc(art(item, 150))}" alt="">
            <div class="qrow__text">
              <strong>${esc(item.name)}</strong>
              <small>${esc(artistLine(item))}</small>
            </div>
          </div>`;
      }).join('');
      return;
    }

    if (npTab === 'why') {
      if (!song) {
        panel.innerHTML = '<p class="panel__note">Play something to see the reasoning.</p>';
        return;
      }
      const rec = song.recommendation;
      if (!rec) {
        panel.innerHTML = `
          <div class="why">
            <div class="why__reason">You chose this one directly</div>
            <p class="why__note">No prediction was involved, so there is nothing to explain. Tracks that arrive from a shelf or a station carry a full signal breakdown here.</p>
          </div>`;
        return;
      }
      const signals = rec.signals || {};
      if (!Object.keys(signals).length) {
        panel.innerHTML = `
          <div class="why">
            <div class="why__reason">${esc(rec.reason || 'Straight from the catalogue')}</div>
            <p class="why__note">This track was not scored against a profile, so there is no signal breakdown. Play a few things and the engine starts ranking these sets around your taste.</p>
          </div>`;
        return;
      }
      const labels = {
        artist: 'Artist match', collab: 'Co-listening', language: 'Language',
        era: 'Release era', popularity: 'Popularity fit', freshness: 'Freshness',
        recall: 'Source confidence',
      };
      // A blank reason means nothing about this listener explains the pick, so
      // say that plainly rather than rendering an empty heading.
      const headline = rec.reason || 'Nothing in your history explains this one';
      const note = rec.score === undefined
        ? 'It came from the set you opened, ordered by fit.'
        : `Ranked ${rec.rank} with a blended score of ${Number(rec.score).toFixed(3)}. Here is what each signal contributed.`;
      panel.innerHTML = `
        <div class="why">
          <div class="why__reason">${esc(headline)}</div>
          <p class="why__note">${esc(note)}</p>
          <div class="why__bars">
            ${Object.entries(signals).map(([key, value]) => `
              <div class="why__bar">
                <span>${esc(labels[key] || key)}</span>
                <div class="why__track"><i style="width:${clamp(value * 100, 0, 100)}%"></i></div>
                <b>${Math.round(value * 100)}</b>
              </div>`).join('')}
          </div>
          <div>
            <p class="why__note" style="margin-bottom:8px">Found by</p>
            <div class="why__sources">
              ${(rec.sources || []).map((s) => `<span class="reason-pill"><span>${esc(s)}</span></span>`).join('')}
              ${rec.discovery ? '<span class="reason-pill"><span>new to you</span></span>' : ''}
            </div>
          </div>
        </div>`;
      return;
    }

    // Lyrics
    if (!song) {
      panel.innerHTML = '<p class="panel__note">Play something first.</p>';
      return;
    }
    panel.innerHTML = '<div class="spinner-row"><span class="spinner"></span>Looking for lyrics</div>';
    try {
      const data = await API.lyrics(song.id);
      if (Player.current?.id !== song.id) return;
      panel.innerHTML = `
        <div class="lyrics">${data.lyrics.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')}</div>
        ${data.copyright ? `<p class="lyrics__copy">${esc(data.copyright)}</p>` : ''}`;
    } catch {
      if (Player.current?.id !== song.id) return;
      panel.innerHTML = '<p class="panel__note">No lyrics available for this track.</p>';
    }
  }

  /* ====================================================================== */
  /* Web Audio visualizer                                                   */
  /* ====================================================================== */

  const Viz = {
    ctx: null,
    analyser: null,
    data: null,
    raf: 0,
    failed: false,
    sources: new WeakMap(),

    ensure() {
      if (this.ctx || this.failed) return;
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) throw new Error('no audio context');
        this.ctx = new AudioCtx();
        this.analyser = this.ctx.createAnalyser();
        this.analyser.fftSize = 128;
        this.analyser.smoothingTimeConstant = 0.78;
        this.analyser.connect(this.ctx.destination);
        this.data = new Uint8Array(this.analyser.frequencyBinCount);
        // Tap both decks so a crossfade stays visible and, more importantly,
        // stays audible: an element left unrouted would go silent.
        DECKS.forEach((deck) => this.attach(deck));
      } catch {
        // Falls back to the CSS keyframe bars. Never let this break audio.
        this.failed = true;
        this.ctx = null;
      }
    },

    /** Route a deck into the analyser. A media element can only ever have one
     *  source node, so the WeakMap guards against a second attempt. */
    attach(deck) {
      if (!this.ctx || !this.analyser || this.sources.has(deck)) return;
      try {
        const source = this.ctx.createMediaElementSource(deck);
        source.connect(this.analyser);
        this.sources.set(deck, source);
      } catch { /* already routed, or unsupported */ }
    },

    start() {
      this.ensure();
      if (!this.analyser) return;
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      const bars = $$('#npViz i');
      if (!bars.length) return;
      const tick = () => {
        this.analyser.getByteFrequencyData(this.data);
        const step = Math.max(1, Math.floor(this.data.length / bars.length));
        bars.forEach((bar, i) => {
          const value = this.data[i * step] || 0;
          // scaleY, not height. Writing height on 28 bars at 60fps forces a
          // layout pass every frame.
          bar.style.transform = `scaleY(${clamp(0.08 + (value / 255), 0.08, 1)})`;
        });
        this.raf = requestAnimationFrame(tick);
      };
      cancelAnimationFrame(this.raf);
      this.raf = requestAnimationFrame(tick);
    },

    stop() {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
    },
  };

  /* ====================================================================== */
  /* Context menu                                                           */
  /* ====================================================================== */

  function openMenu(songId, x, y) {
    const song = SONGS.get(songId);
    if (!song) return;
    const menu = $('#ctxMenu');
    const liked = Store.isLiked(song.id);
    const playlists = Store.playlists;
    menu.innerHTML = `
      <button data-act="next">${ICON_PLAY}<span>Play next</span></button>
      <button data-act="queue">${ICON_MORE}<span>Add to queue</span></button>
      <button data-act="radio">${ICON_RADIO}<span>Start station from this</span></button>
      <hr>
      <button data-act="like">${ICON_HEART}<span>${liked ? 'Remove from liked' : 'Add to liked'}</span></button>
      ${song.album?.id ? `<button data-act="album">${ICON_SPARK}<span>Go to album</span></button>` : ''}
      ${artistsOf(song)[0] ? `<button data-act="artist">${ICON_SPARK}<span>Go to artist</span></button>` : ''}
      <hr>
      ${playlists.length
        ? playlists.map((p) => `<button data-act="add" data-playlist="${esc(p.id)}">${ICON_MORE}<span>Add to ${esc(p.name)}</span></button>`).join('')
        : ''}
      <button data-act="newlist">${ICON_MORE}<span>Add to a new playlist</span></button>
      <button data-act="dislike">${ICON_MORE}<span>Show me less like this</span></button>`;
    menu.dataset.song = songId;
    menu.hidden = false;
    const rect = menu.getBoundingClientRect();
    menu.style.left = `${clamp(x, 8, window.innerWidth - rect.width - 8)}px`;
    menu.style.top = `${clamp(y, 8, window.innerHeight - rect.height - 8)}px`;
  }

  function closeMenu() { $('#ctxMenu').hidden = true; }

  /* ====================================================================== */
  /* Views                                                                  */
  /* ====================================================================== */

  const view = $('#view');

  const FOOTER = `
    <footer class="foot">
      <div class="foot__brand">
        <img src="/static/img/logo.svg" alt="" width="30" height="30">
        <div>
          <strong>MusicArea</strong>
          <small>Music that explains itself</small>
        </div>
      </div>
      <nav class="foot__links" aria-label="Footer">
        <a href="#/home">Home</a>
        <a href="#/browse">Browse</a>
        <a href="#/library">Library</a>
        <a href="#/taste">Taste profile</a>
        <a href="#/settings">Settings</a>
      </nav>
      <p class="foot__note">
        Your listening history, likes and playlists are stored in this browser only.
        Nothing is uploaded and no account is required.
      </p>
    </footer>`;

  function setView(html) {
    view.innerHTML = html + FOOTER;
    view.scrollTop = 0;
    markCurrentRows();
  }

  /** Page title per route, for when nothing is playing yet.
   *  Once a track is loaded the tab shows that instead, which is the more useful
   *  thing for a music app to advertise, so this defers to it. */
  function setTitle(parts) {
    if (Player.current) return;
    const list = (Array.isArray(parts) ? parts : [parts]).filter(Boolean);
    document.title = list.length ? `${list.join(' · ')} | MusicArea` : 'MusicArea';
  }

  const Views = {
    async home() {
      setView(`
        <div id="homeHero"></div>
        ${skeletonShelf('Made for you')}
        ${skeletonShelf('Trending')}`);

      const [feed, browse] = await Promise.allSettled([Feed.load(), API.browse(Store.prefs.language)]);

      const feedData = feed.status === 'fulfilled' ? feed.value : null;
      const browseData = browse.status === 'fulfilled' ? browse.value : null;

      if (!feedData && !browseData) {
        setView(emptyState('Could not reach the music service',
          'Check the connection and try again.',
          '<button class="btn btn--primary" onclick="location.reload()">Retry</button>'));
        return;
      }

      const profile = feedData?.profile;
      // Real covers from the feed, so the hero panel is content and not filler.
      const covers = (feedData?.rows?.[0]?.items
        || browseData?.rows?.find((r) => r.kind === 'songs')?.items
        || []).slice(0, 3);

      const hero = profile && !profile.coldStart
        ? `
          <section class="hero">
            <div class="hero__body">
              <span class="hero__eyebrow">${ICON_SPARK} Your mix is ready</span>
              <h1>Music that keeps<br><em>learning what you love</em></h1>
              <p>Built from ${plural(profile.events, 'listening signal')} across ${plural(profile.artistCount ?? profile.topArtists.length, 'artist')}. Every pick below tells you why it is there.</p>
              <div class="hero__actions">
                <button class="btn btn--primary btn--lg" data-play-shelf="made-for-you">${ICON_PLAY} Play my mix</button>
                <a class="btn btn--outline btn--lg" href="#/taste">See my taste profile</a>
              </div>
              <div class="hero__stats">
                <div class="hero__stat"><span>Top artist</span><strong>${esc(profile.topArtists[0]?.name || 'Learning')}</strong></div>
                <div class="hero__stat"><span>Languages</span><strong>${esc((profile.topLanguages || []).slice(0, 2).map(cap).join(', ') || 'Mixed')}</strong></div>
                <div class="hero__stat"><span>Your era</span><strong>${esc(profile.eraCenter || 'Mixed')}</strong></div>
                <div class="hero__stat"><span>Signals</span><strong>${profile.events}</strong></div>
              </div>
            </div>
            ${heroArt(covers)}
          </section>`
        : `
          <section class="hero">
            <div class="hero__body">
              <span class="hero__eyebrow">${ICON_SPARK} Welcome to MusicArea</span>
              <h1>Press play once.<br><em>The feed does the rest.</em></h1>
              <p>MusicArea studies what you actually finish, skip and repeat, then builds a feed from it. No sign up, and nothing leaves your device: your taste profile lives in this browser.</p>
              <div class="hero__actions">
                <button class="btn btn--primary btn--lg" data-play-shelf="${esc(feedData?.rows?.[0]?.id || 'trending')}">${ICON_PLAY} Start listening</button>
                <a class="btn btn--outline btn--lg" href="#/browse">Browse the catalogue</a>
              </div>
              <div class="hero__stats">
                <div class="hero__stat"><span>Catalogue</span><strong>Millions of tracks</strong></div>
                <div class="hero__stat"><span>Quality</span><strong>Up to 320 kbps</strong></div>
                <div class="hero__stat"><span>Account</span><strong>Not needed</strong></div>
                <div class="hero__stat"><span>Your data</span><strong>Stays local</strong></div>
              </div>
            </div>
            ${heroArt(covers)}
          </section>`;

      const rows = [];
      (feedData?.rows || []).forEach((row, index) => {
        rows.push(shelf(row));
        // Mixes slot in after the first shelf, filled in once they arrive.
        if (index === 0) rows.push('<div id="mixesRow"></div>');
      });
      if (browseData) {
        rows.push(moodStrip(browseData.moods));
        (browseData.rows || []).forEach((row) => rows.push(shelf(row)));
      }

      setView(hero + rows.join(''));
      Home.feed = feedData;
      if (profile && !profile.coldStart) loadMixesRow();
    },

    async browse() {
      setView(`${skeletonShelf('Loading the catalogue')}${skeletonShelf('Charts')}`);
      const data = await API.browse(Store.prefs.language).catch(() => null);
      if (!data) {
        setView(emptyState('Browse is unavailable', 'The catalogue service did not respond. Try again shortly.'));
        return;
      }
      setView(`
        <section class="section">
          <div class="section__head">
            <div><h2>Browse</h2><p>Pick a language and dig in</p></div>
          </div>
          <div class="chip-row">
            ${data.languages.map((lang) => `
              <button class="chip ${lang === Store.prefs.language ? 'is-active' : ''}" data-language="${esc(lang)}">${esc(cap(lang))}</button>`).join('')}
          </div>
        </section>
        <section class="section">
          <div class="section__head">
            <div><h2>Languages</h2><p>What is charting in each right now</p></div>
          </div>
          <div class="grid grid--genres" id="genreGrid">
            ${Array.from({ length: 8 }, () => '<div class="skel" style="aspect-ratio:1.42;border-radius:var(--r-md)"></div>').join('')}
          </div>
        </section>
        <div id="moodHost">${moodStrip(data.moods)}</div>
        ${(data.rows || []).map(shelf).join('')}`);
      loadGenreTiles();
    },

    /** One language: what is trending, charting and newly out in it. */
    async language(id) {
      const name = cap(id);
      setTitle([name, 'Language']);
      setView(`<div class="spinner-row"><span class="spinner"></span>Loading ${esc(name)}</div>`);
      const data = await API.browse(id).catch(() => null);
      if (!data) {
        setView(emptyState(`${name} is unavailable`, 'The catalogue did not respond. Try again shortly.'));
        return;
      }
      const songRow = (data.rows || []).find((r) => r.kind === 'songs');
      const covers = (songRow?.items || []).slice(0, 3);
      document.documentElement.style.setProperty('--hue',
        String(catalogHue(id)));
      setView(`
        <section class="hero hero--mood" style="--hue:${catalogHue(id)}">
          <div class="hero__body">
            <span class="hero__eyebrow">${ICON_SPARK} Language</span>
            <h1>${esc(name)}</h1>
            <p>Everything charting, trending and newly released in ${esc(name)}.</p>
            <div class="hero__actions">
              ${songRow ? `<button class="btn btn--primary btn--lg" data-play-list="${registerList(songRow.items, `${name} trending`)}">${ICON_PLAY} Play trending</button>` : ''}
              <button class="btn btn--outline btn--lg" data-language="${esc(id)}">Make this my default</button>
            </div>
          </div>
          ${heroArt(covers)}
        </section>
        ${(data.rows || []).map(shelf).join('')}`);
    },

    async search(query) {
      if (!query) {
        const recents = Store.recentSearches;
        setView(`
          ${recents.length ? `
          <section class="section">
            <div class="section__head">
              <div><h2>Recent searches</h2></div>
              <div class="section__head-actions">
                <button class="text-btn" id="clearSearches">Clear</button>
              </div>
            </div>
            <div class="chip-row">
              ${recents.map((q) => `
                <button class="chip chip--recent" data-search="${esc(q)}">
                  ${ICON_CLOCK}<span>${esc(q)}</span>
                </button>`).join('')}
            </div>
          </section>` : ''}
          <section class="section">
            <div class="section__head">
              <div><h2>Browse by language</h2><p>What is charting in each right now</p></div>
            </div>
            <div class="grid grid--genres" id="genreGrid">
              ${Array.from({ length: 8 }, () => '<div class="skel" style="aspect-ratio:1.42;border-radius:var(--r-md)"></div>').join('')}
            </div>
          </section>
          <div id="moodHost">${moodStrip(MOODS_FALLBACK)}</div>`);
        if (!isMobile()) $('#searchInput').focus();
        loadGenreTiles();
        return;
      }
      Store.rememberSearch(query);
      $('#searchInput').value = query;
      setTitle([query, 'Search']);
      setView(`<div class="spinner-row"><span class="spinner"></span>Searching for ${esc(query)}</div>`);

      const [songs, albums, artists, playlists] = await Promise.all([
        API.searchSongs(query, 30).catch(() => null),
        API.searchAlbums(query, 12).catch(() => null),
        API.searchArtists(query, 12).catch(() => null),
        API.searchPlaylists(query, 12).catch(() => null),
      ]);

      const songResults = songs?.results || [];
      if (!songResults.length && !albums?.results?.length && !artists?.results?.length) {
        setView(emptyState('Nothing found', `No results for "${query}". Try a different spelling.`));
        return;
      }

      const parts = [];

      // Lead with the single best match, the way a search result page should.
      const topArtist = artists?.results?.[0];
      const topSong = songResults[0];
      if (topSong || topArtist) {
        const useArtist = topArtist && !/\d/.test(query) && topArtist.name
          && query.toLowerCase().includes(topArtist.name.toLowerCase().split(' ')[0]);
        parts.push(useArtist
          ? topResultCard({
            kind: 'Artist',
            name: topArtist.name,
            sub: topArtist.subtitle || 'Artist',
            image: topArtist.image,
            round: true,
            goto: `#/artist/${topArtist.id}`,
            playAttr: `data-artist-radio="${esc(topArtist.id)}"`,
          })
          : topResultCard({
            kind: 'Song',
            name: topSong.name,
            sub: artistLine(topSong),
            image: topSong.image,
            goto: topSong.album?.id ? `#/album/${topSong.album.id}` : '',
            playAttr: `data-play-song="${esc(topSong.id)}"`,
          }));
      }

      if (songResults.length) {
        remember(songResults);
        parts.push(`
          <section class="section">
            <div class="section__head">
              <div><h2>Songs</h2><p>${esc(fmtCount(songs.total) || songResults.length)} matches</p></div>
              <div class="section__head-actions">
                <button class="btn btn--primary" data-play-list="${registerList(songResults, `Search: ${query}`)}">${ICON_PLAY} Play all</button>
              </div>
            </div>
            ${trackList(songResults, { label: `Search: ${query}` })}
          </section>`);
      }
      if (artists?.results?.length) {
        parts.push(shelf({ id: 'sr-artists', title: 'Artists', kind: 'artists', items: artists.results.map(normalizeCard) }));
      }
      if (albums?.results?.length) {
        parts.push(shelf({ id: 'sr-albums', title: 'Albums', kind: 'albums', items: albums.results.map(normalizeCard) }));
      }
      if (playlists?.results?.length) {
        parts.push(shelf({ id: 'sr-playlists', title: 'Playlists', kind: 'playlists', items: playlists.results.map(normalizeCard) }));
      }
      setView(parts.join(''));
    },

    async album(id, { refresh = false } = {}) {
      setView(detailSkeleton());
      const album = await API.album(id, { refresh }).catch(() => null);
      if (!album) {
        setView(emptyState('Album not found', 'That album could not be loaded.'));
        return;
      }
      const songs = album.songs || [];
      remember(songs);
      document.documentElement.style.setProperty('--hue', String(hueOf(album.id)));
      const listKey = registerList(songs, album.name);
      setTitle([album.name, 'Album']);
      const total = songs.reduce((sum, s) => sum + (s.duration || 0), 0);

      setView(`
        <header class="detail">
          <div class="detail__art"><img src="${esc(art(album, 500))}" alt=""></div>
          <div class="detail__body">
            <div class="detail__kind">Album</div>
            <h1>${esc(album.name)}</h1>
            <div class="detail__facts">
              <b>${esc((album.artists?.primary || []).map((a) => a.name).join(', ') || album.subtitle || '')}</b>
              ${album.year ? `<i></i><span>${esc(album.year)}</span>` : ''}
              <i></i><span>${plural(songs.length, 'song')}</span>
              ${total ? `<i></i><span>${fmtTime(total)}</span>` : ''}
              ${album.language ? `<i></i><span>${esc(cap(album.language))}</span>` : ''}
            </div>
            <div class="detail__actions">
              <button class="btn btn--primary btn--lg" data-play-list="${listKey}">${ICON_PLAY} Play</button>
              <button class="btn btn--outline" data-shuffle-list="${listKey}">Shuffle</button>
              <button class="btn btn--outline" data-refresh-album="${esc(album.id)}" aria-label="Refresh album details and artwork">Refresh</button>
              ${songs[0] ? `<button class="btn btn--outline" data-radio="${esc(songs[0].id)}">${ICON_RADIO} Start station</button>` : ''}
            </div>
          </div>
        </header>
        ${trackList(songs, { label: album.name })}
        <div id="moreLikeThis"></div>`);

      loadMoreLikeThis(songs.slice(0, 5).map((s) => s.id), `More like ${album.name}`);
    },

    async playlist(id) {
      setView(detailSkeleton());
      const playlist = await API.playlist(id, 100).catch(() => null);
      if (!playlist) {
        setView(emptyState('Playlist not found', 'That playlist could not be loaded.'));
        return;
      }
      const songs = playlist.songs || [];
      remember(songs);
      document.documentElement.style.setProperty('--hue', String(hueOf(playlist.id)));
      const listKey = registerList(songs, playlist.name);
      setTitle([playlist.name, 'Playlist']);

      setView(`
        <header class="detail">
          <div class="detail__art"><img src="${esc(art(playlist, 500))}" alt=""></div>
          <div class="detail__body">
            <div class="detail__kind">Playlist</div>
            <h1>${esc(playlist.name)}</h1>
            <div class="detail__facts">
              ${playlist.description ? `<span>${esc(playlist.description)}</span><i></i>` : ''}
              <span>${plural(songs.length, 'song')}</span>
              ${playlist.followerCount ? `<i></i><span>${esc(fmtCount(playlist.followerCount))} followers</span>` : ''}
            </div>
            <div class="detail__actions">
              <button class="btn btn--primary btn--lg" data-play-list="${listKey}">${ICON_PLAY} Play</button>
              <button class="btn btn--outline" data-shuffle-list="${listKey}">Shuffle</button>
            </div>
          </div>
        </header>
        ${trackList(songs, { label: playlist.name })}
        <div id="moreLikeThis"></div>`);

      loadMoreLikeThis(songs.slice(0, 5).map((s) => s.id), 'More in this vein');
    },

    async artist(id) {
      setView(detailSkeleton());
      const artist = await API.artist(id).catch(() => null);
      if (!artist) {
        setView(emptyState('Artist not found', 'That artist page could not be loaded.'));
        return;
      }
      const songs = artist.topSongs || [];
      remember(songs);
      document.documentElement.style.setProperty('--hue', String(hueOf(artist.id)));
      const listKey = registerList(songs, artist.name);
      setTitle([artist.name, 'Artist']);
      const bio = Array.isArray(artist.bio) ? artist.bio.map((b) => b.text).filter(Boolean).join('\n\n') : '';

      setView(`
        <header class="detail detail--artist">
          <div class="detail__art"><img src="${esc(art(artist, 500))}" alt=""></div>
          <div class="detail__body">
            <div class="detail__kind">${artist.isVerified ? 'Verified artist' : 'Artist'}</div>
            <h1>${esc(artist.name)}</h1>
            <div class="detail__facts">
              ${artist.followerCount ? `<b>${esc(fmtCount(artist.followerCount))} followers</b>` : ''}
              ${artist.dominantLanguage ? `<i></i><span>${esc(cap(artist.dominantLanguage))}</span>` : ''}
              ${artist.dominantType ? `<i></i><span>${esc(cap(artist.dominantType))}</span>` : ''}
            </div>
            <div class="detail__actions">
              ${songs.length ? `<button class="btn btn--primary btn--lg" data-play-list="${listKey}">${ICON_PLAY} Play</button>` : ''}
              <button class="btn btn--outline" data-artist-radio="${esc(artist.id)}">${ICON_RADIO} Artist station</button>
            </div>
          </div>
        </header>
        ${songs.length ? `
          <section class="section">
            <div class="section__head"><div><h2>Popular</h2></div></div>
            ${trackList(songs.slice(0, 12), { label: artist.name })}
          </section>` : ''}
        ${artist.topAlbums?.length ? shelf({ id: 'artist-albums', title: 'Albums', kind: 'albums', items: artist.topAlbums.map(normalizeCard) }) : ''}
        ${artist.singles?.length ? shelf({ id: 'artist-singles', title: 'Singles', kind: 'songs', items: artist.singles }) : ''}
        ${bio ? `
          <section class="section">
            <div class="section__head"><div><h2>About</h2></div></div>
            <div class="panel"><p class="panel__note" style="white-space:pre-wrap">${esc(bio)}</p></div>
          </section>` : ''}`);
    },

    async mix(id) {
      setView(`<div class="spinner-row"><span class="spinner"></span>Building your mixes</div>`);
      let mix = null;
      try {
        mix = await Mixes.find(id);
      } catch { /* handled below */ }
      if (!mix) {
        setView(emptyState('That mix is not available',
          'Mixes are rebuilt from your listening, so they change as your taste does.',
          '<a class="btn btn--primary" href="#/home">Back to home</a>'));
        return;
      }
      remember(mix.items);
      setTitle([mix.name, 'Mix']);
      const listKey = registerList(mix.items, mix.name);
      document.documentElement.style.setProperty('--hue', String(hueOf(mix.id)));
      const total = mix.items.reduce((sum, s) => sum + (s.duration || 0), 0);

      setView(`
        <header class="detail">
          <div class="detail__art">
            <div class="mix__grid mix__grid--lg">
              ${(mix.covers || []).slice(0, 4).map((c) => `<img src="${esc(art({ image: c }, 500))}" alt="">`).join('')}
            </div>
          </div>
          <div class="detail__body">
            <div class="detail__kind">Generated mix</div>
            <h1>${esc(mix.name)}</h1>
            <div class="detail__facts">
              <span>${esc(mix.note || '')}</span>
            </div>
            <div class="detail__facts" style="margin-top:8px">
              <span>${plural(mix.items.length, 'song')}</span>
              ${total ? `<i></i><span>${fmtTime(total)}</span>` : ''}
              <i></i><span>Refreshes as you listen</span>
            </div>
            <div class="detail__actions">
              <button class="btn btn--primary btn--lg" data-play-list="${listKey}">${ICON_PLAY} Play</button>
              <button class="btn btn--outline" data-shuffle-list="${listKey}">Shuffle</button>
              <button class="btn btn--outline" data-save-mix="${esc(mix.id)}">Save as playlist</button>
              <button class="btn btn--outline" data-refresh-mixes="1">Rebuild</button>
            </div>
          </div>
        </header>
        ${trackList(mix.items, { label: mix.name })}`);
    },

    async mood(id) {
      setView(`<div class="spinner-row"><span class="spinner"></span>Building the set</div>`);
      const data = await API.mood(id).catch(() => null);
      if (!data?.items?.length) {
        setView(emptyState('Mood unavailable', 'Could not build that set right now.'));
        return;
      }
      remember(data.items);
      const listKey = registerList(data.items, data.mood.name);
      document.documentElement.style.setProperty('--hue', String(data.mood.hue));
      setTitle([data.mood.name, 'Mood']);
      const personalised = data.meta?.personalised;
      const blurb = personalised
        ? `${plural(data.meta.pool, 'track')} pulled for this mood, then ordered by how well each one fits your listening.`
        : `${plural(data.items.length, 'track')} for this mood, in the catalogue's own order. Play a few things and this set reorders around your taste.`;
      setView(`
        <section class="hero hero--mood" style="--hue:${data.mood.hue}">
          <div class="hero__body">
            <span class="hero__eyebrow">${ICON_SPARK} Mood</span>
            <h1>${esc(data.mood.name)}</h1>
            <p>${esc(blurb)}</p>
            <div class="hero__actions">
              <button class="btn btn--primary btn--lg" data-play-list="${listKey}">${ICON_PLAY} Play</button>
              <button class="btn btn--outline btn--lg" data-shuffle-list="${listKey}">Shuffle</button>
            </div>
          </div>
          ${heroArt([data.mood, ...data.items])}
        </section>
        ${trackList(data.items, { label: data.mood.name })}`);
    },

    liked() {
      const songs = Store.liked;
      if (!songs.length) {
        setView(emptyState('No liked songs yet',
          'Tap the heart on any track. Likes are the strongest signal the recommender uses.'));
        return;
      }
      const listKey = registerList(songs, 'Liked songs');
      setView(`
        <header class="detail">
          <div class="detail__art shelf-link__art--liked" style="display:grid;place-items:center">
            <svg viewBox="0 0 24 24" style="width:84px;height:84px" aria-hidden="true"><path d="M12 20.7 4.6 13.6a4.9 4.9 0 0 1 7-6.9l.4.4.4-.4a4.9 4.9 0 0 1 7 6.9z"/></svg>
          </div>
          <div class="detail__body">
            <div class="detail__kind">Playlist</div>
            <h1>Liked songs</h1>
            <div class="detail__facts"><span>${plural(songs.length, 'song')}</span><i></i><span>Stored on this device</span></div>
            <div class="detail__actions">
              <button class="btn btn--primary btn--lg" data-play-list="${listKey}">${ICON_PLAY} Play</button>
              <button class="btn btn--outline" data-shuffle-list="${listKey}">Shuffle</button>
            </div>
          </div>
        </header>
        ${trackList(songs, { label: 'Liked songs', unlike: true })}`);
    },

    recent() {
      const songs = Store.recent;
      if (!songs.length) {
        setView(emptyState('Nothing played yet', 'Your recent plays will collect here.'));
        return;
      }
      const listKey = registerList(songs, 'Recently played');
      setView(`
        <section class="section">
          <div class="section__head">
            <div><h2>Recently played</h2><p>${plural(songs.length, 'track')}</p></div>
            <div class="section__head-actions">
              <button class="btn btn--outline" data-play-list="${listKey}">${ICON_PLAY} Play</button>
              <button class="btn btn--outline" id="clearRecent">Clear</button>
            </div>
          </div>
          ${trackList(songs, { label: 'Recently played' })}
        </section>`);
    },

    library() {
      const lists = Store.playlists;
      setTimeout(loadMixesRow, 0);
      setView(`
        <section class="section">
          <div class="section__head">
            <div><h2>Your library</h2><p>Playlists, likes and history live in this browser</p></div>
            <div class="section__head-actions">
              <button class="btn btn--primary" id="libNewPlaylist">New playlist</button>
            </div>
          </div>
          <div class="grid">
            <article class="card" data-goto="#/liked">
              <div class="card__art lib-art lib-art--liked">
                ${collage(Store.liked.map((s) => s.image)) || `
                  <svg viewBox="0 0 24 24" class="lib-art__glyph" aria-hidden="true"><path d="M12 20.7 4.6 13.6a4.9 4.9 0 0 1 7-6.9l.4.4.4-.4a4.9 4.9 0 0 1 7 6.9z"/></svg>`}
                <span class="lib-art__tint"></span>
                <span class="lib-art__badge">${ICON_HEART}</span>
                ${Store.liked.length ? `<button class="card__play" data-play-liked="1" aria-label="Play liked songs">${ICON_PLAY}</button>` : ''}
              </div>
              <div class="card__title">Liked songs</div>
              <div class="card__sub">${plural(Store.liked.length, 'song')}</div>
            </article>
            <article class="card" data-goto="#/recent">
              <div class="card__art lib-art lib-art--recent">
                ${collage(Store.recent.map((s) => s.image)) || `
                  <svg viewBox="0 0 24 24" class="lib-art__glyph" aria-hidden="true"><path d="M12 3a9 9 0 1 0 9 9h-2a7 7 0 1 1-7-7v4l5-4-5-4z"/></svg>`}
                <span class="lib-art__tint"></span>
                <span class="lib-art__badge">${ICON_CLOCK}</span>
                ${Store.recent.length ? `<button class="card__play" data-play-recent="1" aria-label="Play recently played">${ICON_PLAY}</button>` : ''}
              </div>
              <div class="card__title">Recently played</div>
              <div class="card__sub">${plural(Store.recent.length, 'song')}</div>
            </article>
            ${lists.map((list) => `
              <article class="card" data-goto="#/list/${esc(list.id)}">
                <div class="card__art lib-art lib-art--custom">
                  ${collage(list.songs.map((s) => s.image)) || `
                    <svg viewBox="0 0 24 24" class="lib-art__glyph" aria-hidden="true"><path d="M4 6h11v2H4zm0 4h11v2H4zm0 4h7v2H4zm13-6 4 3-4 3z"/></svg>`}
                  <span class="lib-art__tint"></span>
                  <span class="card__tools">
                    <button class="icon-btn" data-rename-list="${esc(list.id)}" aria-label="Rename ${esc(list.name)}" title="Rename">${ICON_EDIT}</button>
                    <button class="icon-btn icon-btn--danger" data-delete-list="${esc(list.id)}" aria-label="Delete ${esc(list.name)}" title="Delete">${ICON_REMOVE}</button>
                  </span>
                </div>
                <div class="card__title">${esc(list.name)}</div>
                <div class="card__sub">${plural(list.songs.length, 'song')}</div>
              </article>`).join('')}
          </div>
        </section>
        <div id="mixesRow"></div>
        <section class="section">
          <div class="section__head"><div><h2>Data</h2><p>Everything is local to this browser</p></div></div>
          <div class="panel">
            <p class="panel__note">${plural(Store.history.length, 'listening signal')} recorded. Clearing this resets your recommendations to a cold start.</p>
            <div style="margin-top:14px"><button class="btn btn--outline" id="clearData">Clear my listening data</button></div>
          </div>
        </section>`);
    },

    localList(id) {
      const list = Store.playlist(id);
      if (!list) {
        setView(emptyState('Playlist not found', 'That playlist is no longer in your library.'));
        return;
      }
      if (!list.songs.length) {
        setView(`
          <header class="detail">
            <div class="detail__art shelf-link__art--custom"></div>
            <div class="detail__body">
              <div class="detail__kind">Your playlist</div>
              <h1>${esc(list.name)}</h1>
              <div class="detail__facts"><span>Empty for now</span></div>
            </div>
          </header>
          ${emptyState('Nothing here yet', 'Use the three dot menu on any track to add it to this playlist.')}`);
        return;
      }
      const listKey = registerList(list.songs, list.name);
      setView(`
        <header class="detail">
          <div class="detail__art shelf-link__art--custom" style="display:grid;place-items:center">
            <svg viewBox="0 0 24 24" style="width:80px;height:80px" aria-hidden="true"><path d="M4 6h11v2H4zm0 4h11v2H4zm0 4h7v2H4zm13-6 4 3-4 3z"/></svg>
          </div>
          <div class="detail__body">
            <div class="detail__kind">Your playlist</div>
            <h1>${esc(list.name)}</h1>
            <div class="detail__facts"><span>${plural(list.songs.length, 'song')}</span></div>
            <div class="detail__actions">
              <button class="btn btn--primary btn--lg" data-play-list="${listKey}">${ICON_PLAY} Play</button>
              <button class="btn btn--outline" data-shuffle-list="${listKey}">Shuffle</button>
              <button class="btn btn--outline" data-rename-list="${esc(list.id)}">${ICON_EDIT} Rename</button>
              <button class="btn btn--outline btn--danger" data-delete-list="${esc(list.id)}">${ICON_REMOVE} Delete</button>
            </div>
          </div>
        </header>
        ${trackList(list.songs, { label: list.name, removeFrom: list.id })}`);
    },

    settings() {
      const p = Store.prefs;
      const qualities = [
        { id: '320kbps', name: 'Highest', note: '320 kbps AAC, the best the source offers' },
        { id: '160kbps', name: 'High', note: '160 kbps, roughly half the data' },
        { id: '96kbps', name: 'Data saver', note: '96 kbps, for a weak connection' },
      ];
      const timers = [0, 15, 30, 45, 60];

      setView(`
        <section class="hero hero--compact">
          <div class="hero__body">
            <span class="hero__eyebrow">${ICON_SPARK} Settings</span>
            <h1>Playback</h1>
            <p>Everything here is stored in this browser and applies the moment you change it.</p>
          </div>
        </section>

        <section class="section">
          <div class="section__head"><div><h2>Audio quality</h2><p>Applies to the next track, and to the current one straight away</p></div></div>
          <div class="panel">
            <div class="opt-list">
              ${qualities.map((q) => `
                <button class="opt ${p.quality === q.id ? 'is-active' : ''}" data-set-quality="${q.id}">
                  <span class="opt__radio"></span>
                  <span class="opt__body">
                    <strong>${esc(q.name)}</strong>
                    <small>${esc(q.note)}</small>
                  </span>
                  <span class="opt__tag">${esc(q.id.replace('kbps', ''))}</span>
                </button>`).join('')}
            </div>
            <p class="panel__note" style="margin-top:14px">If a track is not available at your chosen rate, MusicArea steps down one rung for that track only rather than failing, and the badge next to the volume slider turns amber to tell you.</p>
            <p class="panel__note" style="margin-top:10px"><strong>On lossless:</strong> the catalogue this app streams from publishes five rungs, 12 to 320 kbps, all AAC. There is no FLAC or ALAC tier, so 320 kbps is a real ceiling and not a setting. Anything labelled "lossless" here would be a lie.</p>
          </div>
        </section>

        <section class="section">
          <div class="section__head"><div><h2>Crossfade</h2><p>Blend the end of one track into the start of the next</p></div></div>
          <div class="panel">
            <div class="setting">
              <div class="setting__text">
                <strong>Smooth crossfade</strong>
                <small id="xfLabel">${p.crossfade > 0 ? `${p.crossfade} seconds` : 'Off'}</small>
              </div>
              <button class="switch ${p.crossfade > 0 ? 'is-on' : ''}" id="xfToggle" role="switch"
                      aria-checked="${p.crossfade > 0}" aria-label="Smooth crossfade">
                <span></span>
              </button>
            </div>
            <div class="setting setting--stack" id="xfRow" ${p.crossfade > 0 ? '' : 'hidden'}>
              <input class="range" id="xfRange" type="range" min="1" max="12" step="1"
                     value="${p.crossfade || 6}" aria-label="Crossfade length in seconds">
              <div class="range__scale"><span>1s</span><span>6s</span><span>12s</span></div>
            </div>
            <p class="panel__note">Uses an equal power curve, so the blend holds a steady loudness instead of dipping in the middle. Skipping by hand uses a shorter blend so the button still feels instant. Crossfade is bypassed when Repeat one is active.</p>
          </div>
        </section>

        <section class="section">
          <div class="section__head"><div><h2>Playback</h2></div></div>
          <div class="panel">
            <div class="setting">
              <div class="setting__text">
                <strong>Keep the music going</strong>
                <small>When the queue runs out, extend it with an algorithmic station</small>
              </div>
              <button class="switch ${p.autoplay ? 'is-on' : ''}" id="autoplayToggle" role="switch"
                      aria-checked="${!!p.autoplay}" aria-label="Autoplay station"><span></span></button>
            </div>
            <div class="setting">
              <div class="setting__text">
                <strong>Audio visualizer</strong>
                <small>Real frequency analysis on the now playing screen</small>
              </div>
              <button class="switch ${p.visualizer ? 'is-on' : ''}" id="vizToggle" role="switch"
                      aria-checked="${!!p.visualizer}" aria-label="Audio visualizer"><span></span></button>
            </div>
            <div class="setting setting--stack">
              <div class="setting__text">
                <strong>Sleep timer</strong>
                <small id="sleepLabel">${Sleep.remainingLabel()}</small>
              </div>
              <div class="chip-row" style="padding-bottom:0">
                ${timers.map((m) => `
                  <button class="chip ${Sleep.minutes === m ? 'is-active' : ''}" data-sleep="${m}">
                    ${m === 0 ? 'Off' : `${m} min`}
                  </button>`).join('')}
              </div>
            </div>
          </div>
        </section>

        <section class="section">
          <div class="section__head"><div><h2>Your data</h2><p>None of this leaves your device</p></div></div>
          <div class="panel">
            <p class="panel__note">${plural(Store.history.length, 'listening signal')} recorded, ${plural(Store.liked.length, 'liked song')}, ${plural(Store.playlists.length, 'playlist')}. Your taste profile is sent with a request only to rank that one response, and is never stored on the server.</p>
            <div style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap">
              <a class="btn btn--outline" href="#/taste">View my taste profile</a>
              <button class="btn btn--outline" id="clearData">Clear my listening data</button>
            </div>
          </div>
        </section>

        <section class="section">
          <div class="section__head"><div><h2>Keyboard</h2></div></div>
          <div class="panel">
            <div class="keys">${SHORTCUTS.map(([k, d]) => `
              <div class="keys__row"><kbd>${esc(k)}</kbd><span>${esc(d)}</span></div>`).join('')}</div>
            <p class="panel__note" style="margin-top:16px">Letter shortcuts ignore Shift and Caps Lock, so they work either way. Browser shortcuts such as Ctrl or Cmd combinations are left alone.</p>
          </div>
        </section>`);
    },

    async taste() {
      setView(`<div class="spinner-row"><span class="spinner"></span>Reading your profile</div>`);
      const data = await Feed.load().catch(() => null);
      const profile = data?.profile;
      if (!profile || profile.coldStart) {
        setView(emptyState('Not enough to go on yet',
          'Play a handful of tracks and this page fills up with the artists, languages and eras the algorithm has picked up on.'));
        return;
      }
      const peak = profile.topArtists[0]?.weight || 1;
      setView(`
        <section class="hero hero--compact">
          <div class="hero__body">
            <span class="hero__eyebrow">${ICON_SPARK} Taste profile</span>
            <h1>What the algorithm thinks of you</h1>
            <p>Derived from ${plural(profile.events, 'signal')} in this browser. Recent listening counts for more: the weighting halves every three weeks.</p>
          </div>
        </section>
        <div class="panels">
          <div class="panel">
            <h3>Profile strength</h3>
            <div class="panel__big">${Math.round(profile.strength * 100)}%</div>
            <p class="panel__note">How confident the recommender is. It climbs as you listen.</p>
          </div>
          <div class="panel">
            <h3>Your era</h3>
            <div class="panel__big">${esc(profile.eraCenter || 'Mixed')}</div>
            <p class="panel__note">The weighted centre of the release years you play.</p>
          </div>
          <div class="panel">
            <h3>Mainstream lean</h3>
            <div class="panel__big">${Math.round(profile.mainstream * 100)}%</div>
            <p class="panel__note">100% is chart pop, 0% is deep catalogue.</p>
          </div>
          <div class="panel">
            <h3>Languages</h3>
            <div class="panel__big" style="font-size:20px">${esc((profile.topLanguages || []).map(cap).join(', '))}</div>
            <p class="panel__note">Ordered by how much you play them.</p>
          </div>
        </div>
        <section class="section" style="margin-top:26px">
          <div class="section__head"><div><h2>Top artists</h2><p>Time decayed affinity</p></div></div>
          <div class="panel">
            <div class="rank">
              ${profile.topArtists.map((artist, i) => `
                <div class="rank__row">
                  <span>${i + 1}</span>
                  <div>
                    <div class="rank__name">${esc(artist.name || 'Unknown')}</div>
                    <div class="rank__bar"><i style="width:${clamp((artist.weight / peak) * 100, 4, 100)}%"></i></div>
                  </div>
                  <span>${artist.weight.toFixed(2)}</span>
                </div>`).join('')}
            </div>
          </div>
        </section>
        <section class="section">
          <div class="section__head"><div><h2>Data controls</h2></div></div>
          <div class="panel">
            <p class="panel__note">Your profile never leaves your device except as an anonymous payload used to rank one request.</p>
            <div style="margin-top:14px"><button class="btn btn--outline" id="clearData">Clear my listening data</button></div>
          </div>
        </section>`);
    },
  };

  const Home = {
    feed: null,
    refreshTimer: 0,

    scheduleRefresh() {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = window.setTimeout(() => {
        if (currentRoute().path === 'home') Views.home();
      }, 900);
    },
  };

  const SHORTCUTS = [
    ['Space', 'Play or pause'],
    ['K', 'Play or pause'],
    ['N', 'Next track'],
    ['P', 'Previous track'],
    ['L', 'Like the current track'],
    ['S', 'Shuffle'],
    ['R', 'Repeat'],
    ['Q', 'Queue'],
    ['M', 'Mute'],
    ['/', 'Search'],
    ['left / right', 'Seek 5 seconds'],
    ['shift + left / right', 'Seek 30 seconds'],
    ['up / down', 'Volume'],
    ['Esc', 'Close now playing or the queue'],
  ];

  /** Sleep timer. Fades out rather than cutting off mid bar. */
  const Sleep = {
    minutes: 0,
    endsAt: 0,
    handle: 0,

    set(minutes) {
      clearTimeout(this.handle);
      this.minutes = minutes;
      if (!minutes) {
        this.endsAt = 0;
        toast('Sleep timer off');
        return;
      }
      this.endsAt = Date.now() + minutes * 60000;
      this.handle = setTimeout(() => {
        Player.runFade(audio, null, 6, () => {
          audio.pause();
          audio.volume = gain();
          setPlayerState('paused');
        });
        this.minutes = 0;
        this.endsAt = 0;
        toast('Sleep timer reached, fading out');
      }, minutes * 60000);
      toast(`Sleeping in ${minutes} minutes`);
    },

    remainingLabel() {
      if (!this.endsAt) return 'Off';
      const mins = Math.max(0, Math.round((this.endsAt - Date.now()) / 60000));
      return `Stops in about ${plural(mins, 'minute')}`;
    },
  };

  const MOODS_FALLBACK = [
    { id: 'romance', name: 'Romance', hue: 336 }, { id: 'party', name: 'Party', hue: 24 },
    { id: 'chill', name: 'Chill', hue: 190 }, { id: 'sad', name: 'Heartbreak', hue: 220 },
    { id: 'workout', name: 'Workout', hue: 8 }, { id: 'retro', name: 'Retro Gold', hue: 268 },
    { id: 'indie', name: 'Indie', hue: 158 }, { id: 'focus', name: 'Focus', hue: 210 },
  ];

  /** Mood tiles: real artwork under a tint in the mood's own hue, so they read
   *  as moods rather than as albums. Falls back to the plain tint when the
   *  catalogue gave us no image. */
  function moodStrip(moods) {
    const list = moods?.length ? moods : MOODS_FALLBACK;
    return `
      <section class="section" data-section="moods">
        <div class="section__head">
          <div><h2>Moods</h2><p>Ready made sets, reordered around what you play</p></div>
        </div>
        <div class="shelf shelf--moods">
          ${list.map((mood) => {
            const cover = mood.image ? art(mood, 500) : '';
            // Catalogue covers remain available when a mood visual is absent,
            // but a supplied mood image always wins so Romance, Focus and Party
            // feel distinct before the listener has opened the set.
            const tiles = !cover && (mood.covers || []).length >= 4
              ? mood.covers.slice(0, 4).map((c) => art({ image: c }, 150))
              : [];
            return `
            <a class="mood-tile" href="#/mood/${esc(mood.id)}" style="--hue:${mood.hue}">
              ${cover
                ? `<img class="mood-tile__img" loading="lazy" decoding="async" src="${esc(cover)}" alt="${esc(mood.name)} mood artwork">`
                : (tiles.length ? `<span class="mood-tile__grid">${tiles.map((t) => `<img loading="lazy" decoding="async" src="${esc(t)}" alt="">`).join('')}</span>` : '')}
              <span class="mood-tile__tint"></span>
              <span class="mood-tile__name">${esc(mood.name)}</span>
              <button class="mood-tile__play" data-play-mood="${esc(mood.id)}"
                      aria-label="Play ${esc(mood.name)}">${ICON_PLAY}</button>
            </a>`;
          }).join('')}
        </div>
      </section>`;
  }

  /** Fanned cover art for the hero. Renders nothing rather than a broken frame
   *  when the feed has not produced enough artwork. */
  function heroArt(items) {
    const covers = (items || []).map((i) => art(i, 500)).filter(Boolean).slice(0, 3);
    if (covers.length < 3) return '';
    return `
      <div class="hero__art" aria-hidden="true">
        ${covers.map((url) => `<figure><img loading="lazy" decoding="async" src="${esc(url)}" alt=""></figure>`).join('')}
      </div>`;
  }

  /** Mirrors LANGUAGE_HUES in catalog.py so a language keeps the same colour
   *  on its tile and on its own page. */
  const LANGUAGE_HUES = {
    hindi: 268, english: 210, punjabi: 24, tamil: 158, telugu: 190,
    marathi: 336, bengali: 44, kannada: 292, malayalam: 130, gujarati: 8,
    bhojpuri: 58, urdu: 240, haryanvi: 100, rajasthani: 320,
    assamese: 176, odia: 12,
  };
  const catalogHue = (language) => LANGUAGE_HUES[String(language).toLowerCase()] ?? 268;

  function cap(text) {
    return String(text || '').replace(/^\w/, (c) => c.toUpperCase());
  }

  function normalizeCard(item) {
    return {
      id: item.id,
      name: item.name || item.title,
      subtitle: item.subtitle
        || (item.artists?.primary || []).map((a) => a.name).join(', ')
        || (item.songCount ? plural(item.songCount, 'song') : '')
        || item.role || '',
      type: item.type || 'album',
      image: item.image,
      year: item.year,
      songCount: item.songCount,
    };
  }

  function detailSkeleton() {
    return `
      <header class="detail">
        <div class="skel detail__art"></div>
        <div class="detail__body" style="width:100%">
          <div class="skel skel-line" style="width:80px"></div>
          <div class="skel" style="height:42px;width:min(420px,60%);margin:14px 0"></div>
          <div class="skel skel-line skel-line--sm"></div>
        </div>
      </header>
      <div class="tracks">
        ${Array.from({ length: 8 }, () => `
          <div class="track"><div class="skel" style="height:42px;width:42px;border-radius:7px"></div>
          <div class="skel skel-line" style="width:60%"></div><div></div><div></div><div></div></div>`).join('')}
      </div>`;
  }

  /** A four cover collage. Used by category tiles and library shelves so those
   *  screens show the music they contain instead of a generic glyph. */
  function collage(covers, { size = 150, cls = '' } = {}) {
    const list = (covers || []).filter(Boolean).slice(0, 4);
    if (!list.length) return '';
    return `<span class="collage ${cls}">${list.map((c) => `
      <img loading="lazy" decoding="async" src="${esc(art({ image: c }, size))}" alt="">`).join('')}</span>`;
  }

  /** Category tile, shared by languages on search and browse. */
  function genreTile(item, href) {
    return `
      <a class="mood-tile" href="${esc(href)}" style="--hue:${item.hue}">
        ${collage(item.covers, { cls: 'collage--soft' })}
        <span class="mood-tile__tint"></span>
        <span class="mood-tile__name">${esc(item.name)}</span>
      </a>`;
  }

  /** The single best match, given prominence at the top of a result page. */
  function topResultCard({ kind, name, sub, image, round, goto, playAttr }) {
    return `
      <section class="section">
        <div class="section__head"><div><h2>Top result</h2></div></div>
        <article class="top-result" ${goto ? `data-goto="${esc(goto)}"` : ''}>
          <div class="top-result__art ${round ? 'is-round' : ''}">
            <img decoding="async" src="${esc(art({ image }, 500))}" alt="">
          </div>
          <div class="top-result__body">
            <span class="top-result__kind">${esc(kind)}</span>
            <h3>${esc(name)}</h3>
            <p>${esc(sub || '')}</p>
          </div>
          <button class="top-result__play" ${playAttr} aria-label="Play ${esc(name)}">${ICON_PLAY}</button>
        </article>
      </section>`;
  }

  /** Language tiles for the search screen, loaded after first paint. */
  async function loadGenreTiles() {
    const grid = $('#genreGrid');
    if (!grid) return;
    try {
      const data = await API.genres();
      if (!$('#genreGrid')) return;
      grid.innerHTML = (data.languages || [])
        .map((lang) => genreTile(lang, `#/language/${lang.id}`)).join('');
      const moodHost = $('#moodHost');
      if (moodHost && data.moods?.length) moodHost.innerHTML = moodStrip(data.moods);
    } catch {
      grid.innerHTML = '';
    }
  }

  /** Fill the home mixes shelf. Deliberately after first paint: a cold build
   *  takes a few seconds and must not delay the rest of the page. */
  async function loadMixesRow() {
    const host = $('#mixesRow');
    if (!host) return;
    host.innerHTML = skeletonShelf('Your mixes', 5);
    try {
      const data = await Mixes.load();
      const list = data?.mixes || [];
      if (!list.length) {
        host.innerHTML = '';
        return;
      }
      host.innerHTML = `
        <section class="section" data-section="mixes">
          <div class="section__head">
            <div>
              <h2>Your mixes</h2>
              <p>Playlists built from your listening, refreshed as it changes</p>
            </div>
            <div class="section__head-actions">
              <button class="text-btn" data-refresh-mixes="1">Rebuild</button>
            </div>
          </div>
          <div class="shelf" style="grid-auto-columns:186px">
            ${list.map(mixCard).join('')}
          </div>
        </section>`;
    } catch {
      host.innerHTML = '';
    }
  }

  async function loadMoreLikeThis(ids, title) {
    const host = $('#moreLikeThis');
    if (!host || !ids.length) return;
    try {
      const data = await API.similar(ids, 12);
      if (!data.items?.length) return;
      host.innerHTML = shelf({ id: 'more-like-this', title, subtitle: 'Ranked by the same engine that builds your home feed', kind: 'songs', items: data.items });
      markCurrentRows();
    } catch { /* optional strip */ }
  }

  /* ====================================================================== */
  /* Router                                                                 */
  /* ====================================================================== */

  function currentRoute() {
    const raw = location.hash.replace(/^#\/?/, '');
    const [path, ...rest] = raw.split('/');
    return { path: path || 'home', param: rest.join('/') };
  }

  async function route() {
    const { path, param } = currentRoute();
    $$('[data-route]').forEach((link) => {
      link.classList.toggle('is-active', link.dataset.route === path);
    });
    if (path !== 'search') {
      $('#searchInput').value = '';
      $('#searchClear').hidden = true;
    }
    closeMenu();
    hideSuggest();

    const TITLES = {
      home: 'Home', browse: 'Browse', search: 'Search', library: 'Your library',
      liked: 'Liked songs', recent: 'Recently played', taste: 'Taste profile',
      settings: 'Settings',
    };
    // Detail views set a richer title once their data lands.
    setTitle(TITLES[path] || null);

    try {
      switch (path) {
        case 'home': return await Views.home();
        case 'browse': return await Views.browse();
        case 'search': return await Views.search(decodeURIComponent(param || ''));
        case 'album': return await Views.album(param);
        case 'playlist': return await Views.playlist(param);
        case 'artist': return await Views.artist(param);
        case 'mood': return await Views.mood(param);
        case 'liked': return Views.liked();
        case 'recent': return Views.recent();
        case 'library': return Views.library();
        case 'list': return Views.localList(param);
        case 'taste': return await Views.taste();
        case 'settings': return Views.settings();
        case 'mix': return await Views.mix(param);
        case 'language': return await Views.language(param);
        default:
          location.hash = '#/home';
          return undefined;
      }
    } catch (error) {
      setView(emptyState('Something broke on that page', error.message || 'Unknown error'));
      return undefined;
    }
  }

  /* ====================================================================== */
  /* Sidebar rendering                                                      */
  /* ====================================================================== */

  function renderSidebarCounts() {
    $('#likedCount').textContent = plural(Store.liked.length, 'song');
    $('#recentCount').textContent = plural(Store.recent.length, 'song');
  }

  function renderPlaylistList() {
    const host = $('#playlistList');
    host.innerHTML = Store.playlists.map((list) => `
      <a class="shelf-link" href="#/list/${esc(list.id)}">
        <span class="shelf-link__art shelf-link__art--custom">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h11v2H4zm0 4h11v2H4zm0 4h7v2H4zm13-6 4 3-4 3z"/></svg>
        </span>
        <span class="shelf-link__meta">
          <strong>${esc(list.name)}</strong>
          <small>${plural(list.songs.length, 'song')}</small>
        </span>
      </a>`).join('');
  }

  /* Kept deliberately in step with recommender.py. These previously used two
     different formulas, so the sidebar bar and the taste page reported two
     different strengths for the same profile (35% against 100%). Change one and
     you must change the other. */
  const EVENT_WEIGHTS = {
    play: 1.0, complete: 1.7, repeat: 2.2, like: 2.6, playlist_add: 2.0,
    queue: 1.1, search_play: 1.3, skip: -0.7, dislike: -2.4,
  };
  const HALF_LIFE_DAYS = 21;
  const STRENGTH_TARGET = 25;

  /** Time decayed sum of positive signals, normalised to 0..1. */
  function localProfileStrength() {
    const now = Date.now();
    let total = 0;
    for (const entry of Store.history) {
      const base = EVENT_WEIGHTS[entry.event] ?? 1.0;
      if (base <= 0) continue;
      const ageDays = entry.at ? Math.max(0, (now - entry.at) / 86400000) : null;
      const decay = ageDays === null ? 0.35 : 0.5 ** (ageDays / HALF_LIFE_DAYS);
      total += base * decay;
    }
    return clamp(total / STRENGTH_TARGET, 0, 1);
  }

  function renderTasteCard(serverStrength) {
    // Prefer the value the engine actually reported; fall back to the identical
    // local calculation before the first feed request has landed.
    const strength = typeof serverStrength === 'number'
      ? serverStrength
      : localProfileStrength();
    const counted = Store.history.filter((e) => (EVENT_WEIGHTS[e.event] ?? 1) > 0).length;
    $('#tasteBar').style.width = `${Math.round(strength * 100)}%`;
    $('#tasteHint').textContent = counted
      ? `${Math.round(strength * 100)}% from ${plural(counted, 'signal')}`
      : 'Listening to learn';
  }

  /* ====================================================================== */
  /* Search suggestions                                                     */
  /* ====================================================================== */

  let suggestTimer = 0;
  let suggestCursor = -1;

  function hideSuggest() {
    $('#suggest').hidden = true;
    suggestCursor = -1;
  }

  async function runSuggest(query) {
    if (!query || query.length < 2) return hideSuggest();
    let data;
    try {
      data = await API.suggest(query);
    } catch { return hideSuggest(); }
    if ($('#searchInput').value.trim() !== query) return undefined;

    const groups = [
      ['Songs', (data.songs?.results || []).slice(0, 4), 'song'],
      ['Artists', (data.artists?.results || []).slice(0, 3), 'artist'],
      ['Albums', (data.albums?.results || []).slice(0, 3), 'album'],
      ['Playlists', (data.playlists?.results || []).slice(0, 2), 'playlist'],
    ].filter(([, items]) => items.length);

    if (!groups.length) return hideSuggest();

    const host = $('#suggest');
    host.innerHTML = groups.map(([label, items, kind]) => `
      <div class="suggest__group">${label}</div>
      ${items.map((item) => `
        <button class="suggest__item ${kind === 'artist' ? 'is-round' : ''}" type="button"
                data-suggest-kind="${kind}" data-suggest-id="${esc(item.id)}" data-suggest-name="${esc(item.title || item.name)}">
          <img loading="lazy" decoding="async" src="${esc(art(item, 150))}" alt="">
          <span class="suggest__item-meta">
            <strong>${esc(stripTags(item.title || item.name))}</strong>
            <small>${esc(stripTags(item.description || item.primaryArtists || item.album || cap(kind)))}</small>
          </span>
        </button>`).join('')}`).join('');
    host.hidden = false;
    suggestCursor = -1;
    return undefined;
  }

  function stripTags(text) {
    return String(text || '').replace(/<[^>]*>/g, '');
  }

  /* ====================================================================== */
  /* Event wiring                                                           */
  /* ====================================================================== */

  function playListFromKey(key, { shuffle = false, index = 0 } = {}) {
    const entry = LISTS.get(key);
    if (!entry?.songs?.length) return;
    if (shuffle) {
      Store.prefs.shuffle = true;
      Store.savePrefs();
      syncTransport();
      Player.play(entry.songs, Math.floor(Math.random() * entry.songs.length), { label: entry.label });
      return;
    }
    Player.play(entry.songs, index, { label: entry.label });
  }

  function wire() {
    /* --- global click delegation ------------------------------------- */
    document.addEventListener('click', async (event) => {
      const target = event.target;

      const menuBtn = target.closest('[data-menu]');
      if (menuBtn) {
        event.stopPropagation();
        const rect = menuBtn.getBoundingClientRect();
        openMenu(menuBtn.dataset.menu, rect.left - 200, rect.bottom + 6);
        return;
      }

      const menuItem = target.closest('#ctxMenu button');
      if (menuItem) {
        const song = SONGS.get($('#ctxMenu').dataset.song);
        closeMenu();
        if (!song) return;
        const act = menuItem.dataset.act;
        if (act === 'next') { Player.enqueue(song, { next: true }); toast(`Playing next: ${song.name}`); }
        if (act === 'queue') { Player.enqueue(song); toast(`Queued ${song.name}`); }
        if (act === 'radio') { startRadio(song.id); }
        if (act === 'like') { const now = Store.toggleLike(song); toast(now ? 'Added to liked' : 'Removed from liked'); refreshLikeButtons(song.id); }
        if (act === 'album' && song.album?.id) location.hash = `#/album/${song.album.id}`;
        if (act === 'artist') { const a = artistsOf(song)[0]; if (a) location.hash = `#/artist/${a.id}`; }
        if (act === 'add') { const ok = Store.addToPlaylist(menuItem.dataset.playlist, song); toast(ok ? 'Added to playlist' : 'Already in that playlist'); }
        if (act === 'newlist') {
          const name = await askText('New playlist', 'My playlist', 'Create');
          if (name) {
            const list = Store.createPlaylist(name);
            Store.addToPlaylist(list.id, song);
            toast(`Created ${list.name}`);
          }
        }
        if (act === 'dislike') { Store.logEvent(song, 'dislike'); toast('Noted. You will see less like that.'); }
        return;
      }
      closeMenu();

      const likeBtn = target.closest('[data-like]');
      if (likeBtn) {
        event.stopPropagation();
        const song = SONGS.get(likeBtn.dataset.like);
        if (song) {
          const now = Store.toggleLike(song);
          refreshLikeButtons(song.id);
          toast(now ? 'Added to liked songs' : 'Removed from liked songs');
        }
        return;
      }

      const removeFromList = target.closest('[data-remove-from-list]');
      if (removeFromList) {
        event.stopPropagation();
        const { removeFromList: listId, song: songId } = removeFromList.dataset;
        const song = SONGS.get(songId);
        Store.removeFromPlaylist(listId, songId);
        toast(`Removed ${song?.name || 'track'}`);
        route();
        return;
      }

      const unlike = target.closest('[data-unlike]');
      if (unlike) {
        event.stopPropagation();
        const song = Store.liked.find((s) => s.id === unlike.dataset.unlike);
        Store.toggleLike(song || { id: unlike.dataset.unlike });
        toast('Removed from liked songs');
        route();
        return;
      }

      const playSong = target.closest('[data-play-song]');
      if (playSong) {
        event.stopPropagation();
        const shelfEl = playSong.closest('[data-shelf-list]');
        const song = SONGS.get(playSong.dataset.playSong);
        if (shelfEl) {
          const entry = LISTS.get(shelfEl.dataset.shelfList);
          const index = entry.songs.findIndex((s) => s.id === playSong.dataset.playSong);
          Player.play(entry.songs, Math.max(0, index), { label: entry.label });
        } else if (song) {
          Player.play([song], 0);
        }
        return;
      }

      const openSong = target.closest('[data-open-song]');
      if (openSong) {
        const song = SONGS.get(openSong.dataset.openSong);
        const shelfEl = openSong.closest('[data-shelf-list]');
        if (shelfEl) {
          const entry = LISTS.get(shelfEl.dataset.shelfList);
          const index = entry.songs.findIndex((s) => s.id === openSong.dataset.openSong);
          Player.play(entry.songs, Math.max(0, index), { label: entry.label });
        } else if (song) Player.play([song], 0);
        return;
      }

      const trackEl = target.closest('.track[data-list]');
      if (trackEl) {
        const entry = LISTS.get(trackEl.dataset.list);
        if (entry) Player.play(entry.songs, Number(trackEl.dataset.index), { label: entry.label });
        return;
      }

      const searchChip = target.closest('[data-search]');
      if (searchChip) {
        location.hash = `#/search/${encodeURIComponent(searchChip.dataset.search)}`;
        return;
      }

      if (target.closest('#clearSearches')) {
        Store.clearSearches();
        toast('Recent searches cleared');
        route();
        return;
      }

      if (target.closest('[data-play-liked]')) {
        event.stopPropagation();
        if (Store.liked.length) Player.play(Store.liked, 0, { label: 'Liked songs' });
        return;
      }

      if (target.closest('[data-play-recent]')) {
        event.stopPropagation();
        if (Store.recent.length) Player.play(Store.recent, 0, { label: 'Recently played' });
        return;
      }

      const playMood = target.closest('[data-play-mood]');
      if (playMood) {
        event.preventDefault();
        event.stopPropagation();
        const id = playMood.dataset.playMood;
        toast('Building that set');
        try {
          const data = await API.mood(id, 40);
          if (!data.items?.length) throw new Error('empty');
          remember(data.items);
          Player.play(data.items, 0, { label: data.mood.name });
        } catch {
          toast('Could not build that mood right now');
        }
        return;
      }

      const playMix = target.closest('[data-play-mix]');
      if (playMix) {
        event.stopPropagation();
        const mix = await Mixes.find(playMix.dataset.playMix).catch(() => null);
        if (mix?.items?.length) Player.play(mix.items, 0, { label: mix.name });
        else toast('Could not load that mix');
        return;
      }

      const saveMix = target.closest('[data-save-mix]');
      if (saveMix) {
        const mix = await Mixes.find(saveMix.dataset.saveMix).catch(() => null);
        if (!mix) return;
        const list = Store.createPlaylist(mix.name);
        mix.items.forEach((song) => Store.addToPlaylist(list.id, song));
        toast(`Saved ${mix.items.length} tracks to ${list.name}`);
        return;
      }

      if (target.closest('[data-refresh-mixes]')) {
        Mixes.invalidate();
        toast('Rebuilding your mixes');
        if (currentRoute().path === 'mix') {
          await Mixes.load(true);
          route();
        } else {
          loadMixesRow();
        }
        return;
      }

      /* --- library edit and delete ------------------------------------ */

      const renameList = target.closest('[data-rename-list]');
      if (renameList) {
        const list = Store.playlist(renameList.dataset.renameList);
        if (!list) return;
        event.stopPropagation();
        const name = await askText('Rename playlist', list.name, 'Rename');
        if (name) {
          Store.renamePlaylist(list.id, name);
          toast('Playlist renamed');
          route();
        }
        return;
      }

      if (target.closest('#clearRecent')) {
        if (await askConfirm('Clear recently played?',
          'This only clears the list. Your taste profile is not affected.', 'Clear')) {
          Store.clearRecent();
          toast('Recently played cleared');
          route();
        }
        return;
      }

      const refreshAlbum = target.closest('[data-refresh-album]');
      if (refreshAlbum) {
        toast('Refreshing album details and artwork');
        Views.album(refreshAlbum.dataset.refreshAlbum, { refresh: true });
        return;
      }

      const playList = target.closest('[data-play-list]');
      if (playList) { playListFromKey(playList.dataset.playList); return; }

      const shuffleList = target.closest('[data-shuffle-list]');
      if (shuffleList) { playListFromKey(shuffleList.dataset.shuffleList, { shuffle: true }); return; }

      const playShelf = target.closest('[data-play-shelf]');
      if (playShelf) {
        const sectionEl = $(`[data-section="${playShelf.dataset.playShelf}"]`) ;
        const shelfEl = sectionEl ? $('[data-shelf-list]', sectionEl) : null;
        if (shelfEl) playListFromKey(shelfEl.dataset.shelfList);
        else {
          const first = $('[data-shelf-list]');
          if (first) playListFromKey(first.dataset.shelfList);
        }
        return;
      }

      const playAlbum = target.closest('[data-play-album]');
      if (playAlbum) {
        event.stopPropagation();
        const album = await API.album(playAlbum.dataset.playAlbum).catch(() => null);
        if (album?.songs?.length) Player.play(album.songs, 0, { label: album.name });
        else toast('Could not load that album');
        return;
      }

      const playPlaylist = target.closest('[data-play-playlist]');
      if (playPlaylist) {
        event.stopPropagation();
        const list = await API.playlist(playPlaylist.dataset.playPlaylist, 60).catch(() => null);
        if (list?.songs?.length) Player.play(list.songs, 0, { label: list.name });
        else toast('Could not load that playlist');
        return;
      }

      const playArtist = target.closest('[data-play-artist]');
      if (playArtist) {
        event.stopPropagation();
        startArtistRadio(playArtist.dataset.playArtist);
        return;
      }

      const radioBtn = target.closest('[data-radio]');
      if (radioBtn) { startRadio(radioBtn.dataset.radio); return; }

      const artistRadioBtn = target.closest('[data-artist-radio]');
      if (artistRadioBtn) { startArtistRadio(artistRadioBtn.dataset.artistRadio); return; }

      const goto = target.closest('[data-goto]');
      if (goto) { location.hash = goto.dataset.goto; return; }

      const languageChip = target.closest('[data-language]');
      if (languageChip) {
        Store.prefs.language = languageChip.dataset.language;
        Store.savePrefs();
        route();
        return;
      }

      const queueRow = target.closest('[data-queue-pos]');
      if (queueRow) {
        const removeBtn = target.closest('[data-queue-remove]');
        if (removeBtn) {
          event.stopPropagation();
          Player.removeFromQueue(Number(removeBtn.dataset.queueRemove));
        } else {
          Player.load(Number(queueRow.dataset.queuePos));
        }
        return;
      }

      const suggestItem = target.closest('[data-suggest-kind]');
      if (suggestItem) {
        const { suggestKind: kind, suggestId: id, suggestName: name } = suggestItem.dataset;
        hideSuggest();
        $('#searchInput').blur();
        if (kind === 'song') {
          const songs = await API.songs([id]).catch(() => null);
          if (songs?.length) Player.play(songs, 0, { label: name });
        } else {
          location.hash = `#/${kind}/${id}`;
        }
        return;
      }

      if (target.closest('#libNewPlaylist') || target.closest('#newPlaylistBtn')) {
        const name = await askText('New playlist', 'My playlist', 'Create');
        if (name) {
          const list = Store.createPlaylist(name);
          location.hash = `#/list/${list.id}`;
          toast(`Created ${list.name}`);
        }
        return;
      }

      const deleteList = target.closest('[data-delete-list]');
      if (deleteList) {
        event.stopPropagation();
        const list = Store.playlist(deleteList.dataset.deleteList);
        const ok = await askConfirm(
          `Delete ${list?.name || 'this playlist'}?`,
          'The playlist is removed from this browser. The songs themselves stay in the catalogue.',
        );
        if (ok) {
          Store.deletePlaylist(deleteList.dataset.deleteList);
          toast('Playlist deleted');
          if (currentRoute().path === 'list') location.hash = '#/library';
          else route();
        }
        return;
      }

      /* --- settings controls ----------------------------------------- */

      const setQuality = target.closest('[data-set-quality]');
      if (setQuality) {
        applyQuality(setQuality.dataset.setQuality);
        Views.settings();
        return;
      }

      if (target.closest('#xfToggle')) {
        const on = Store.prefs.crossfade > 0;
        Store.prefs.crossfade = on ? 0 : 6;
        Store.savePrefs();
        Views.settings();
        toast(on ? 'Crossfade off' : 'Crossfade on, 6 seconds');
        return;
      }

      if (target.closest('#autoplayToggle')) {
        Store.prefs.autoplay = !Store.prefs.autoplay;
        Store.savePrefs();
        Views.settings();
        toast(Store.prefs.autoplay ? 'Queue will keep extending' : 'Queue will stop at the end');
        return;
      }

      if (target.closest('#vizToggle')) {
        Store.prefs.visualizer = !Store.prefs.visualizer;
        Store.savePrefs();
        if (!Store.prefs.visualizer) Viz.stop();
        Views.settings();
        return;
      }

      const sleepBtn = target.closest('[data-sleep]');
      if (sleepBtn) {
        Sleep.set(Number(sleepBtn.dataset.sleep));
        Views.settings();
        return;
      }

      if (target.closest('#clearData')) {
        if (await askConfirm('Clear your listening data?',
          'Your history, recent plays and taste profile are erased and recommendations reset to a cold start. Playlists and likes are kept.',
          'Clear data')) {
          Store.clearHistory();
          Mixes.invalidate();
          toast('Listening data cleared');
          route();
        }
      }
    });

    /* --- player controls -----------------------------------------------
       One delegated handler serves both the bar and the full screen overlay, so
       the two sets of buttons cannot drift out of step. */
    document.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-pa]');
      if (!btn) return;
      const action = btn.dataset.pa;

      // The bar's "now playing" region is itself an expand target, but the
      // controls sitting inside it must win.
      if (action === 'expand') {
        if (event.target.closest('[data-pa]:not([data-pa="expand"])')) return;
        // On a phone the whole bar expands. On desktop the title stays a link to
        // the album, so only the artwork and the explicit button expand.
        const onTitle = event.target.closest('.player__title');
        if (onTitle && !isMobile()) return;
        if (onTitle) event.preventDefault();
        if (Player.current) openNp();
        return;
      }

      switch (action) {
        case 'toggle': Player.toggle(); break;
        case 'next': Player.next(true); break;
        case 'prev': Player.prev(); break;
        case 'mute': $('#muteBtn').click(); break;
        case 'queue':
        case 'queue-panel': {
          if (action === 'queue-panel' || !$('#np').hidden) {
            npTab = 'queue';
            syncNpTabs();
            renderNpPanel();
            if ($('#np').hidden) openNp();
            return;
          }
          const drawer = $('#queueDrawer');
          drawer.hidden = !drawer.hidden;
          if (!drawer.hidden) renderQueue();
          break;
        }
        case 'lyrics':
          npTab = 'lyrics';
          syncNpTabs();
          openNp();
          break;
        case 'station':
          if (Player.current) startRadio(Player.current.id);
          break;
        case 'add-to-playlist':
          if (Player.current) {
            const rect = btn.getBoundingClientRect();
            openMenu(Player.current.id, rect.left - 200, Math.max(12, rect.top - 240));
          }
          break;
        case 'shuffle': {
          Store.prefs.shuffle = !Store.prefs.shuffle;
          Store.savePrefs();
          if (Player.queue.length) {
            const currentQueueIndex = Player.order[Player.pos];
            Player.rebuildOrder(currentQueueIndex);
            // Stay pointed at the track that is actually playing. Shuffling on
            // puts it first, but shuffling off restores the original order where
            // it can sit anywhere. Assuming 0 made Next jump backwards.
            Player.pos = Math.max(0, Player.order.indexOf(currentQueueIndex));
            renderQueue();
            markCurrentRows();
          }
          syncTransport();
          toast(Store.prefs.shuffle ? 'Shuffle on' : 'Shuffle off');
          break;
        }
        case 'repeat': {
          const modes = ['off', 'all', 'one'];
          Store.prefs.repeat = modes[(modes.indexOf(Store.prefs.repeat) + 1) % modes.length];
          Store.savePrefs();
          syncTransport();
          toast(Store.prefs.repeat === 'off' ? 'Repeat off'
            : Store.prefs.repeat === 'all' ? 'Repeat queue' : 'Repeat one');
          break;
        }
        case 'like': {
          if (!Player.current) return;
          const now = Store.toggleLike(Player.current);
          refreshLikeButtons(Player.current.id);
          toast(now ? 'Added to liked songs' : 'Removed from liked songs');
          break;
        }
        default: break;
      }
    });

    $('#volume').addEventListener('input', (event) => {
      applyVolume(Number(event.target.value) / 100);
    });

    $('#muteBtn').addEventListener('click', () => {
      Store.prefs.muted = !Store.prefs.muted;
      // Remember the level so unmuting restores it rather than jumping to full.
      if (Store.prefs.muted) {
        Store.prefs.lastVolume = Store.prefs.volume || 0.85;
      }
      Store.savePrefs();
      DECKS.forEach((deck) => { deck.muted = Store.prefs.muted; });
      $('#muteBtn').classList.toggle('is-muted', Store.prefs.muted);
      if (!Store.prefs.muted && !Store.prefs.volume) {
        applyVolume(Store.prefs.lastVolume || 0.85);
      }
    });

    $('#quality').addEventListener('click', () => {
      const order = ['320kbps', '160kbps', '96kbps'];
      applyQuality(order[(order.indexOf(Store.prefs.quality) + 1) % order.length]);
    });

    // Crossfade length slider lives inside a re-rendered view, so it is bound
    // by delegation rather than a direct listener.
    document.addEventListener('input', (event) => {
      const range = event.target.closest?.('#xfRange');
      if (!range) return;
      Store.prefs.crossfade = Number(range.value);
      Store.savePrefs();
      const label = $('#xfLabel');
      if (label) label.textContent = `${Store.prefs.crossfade} seconds`;
    });

    /* --- scrubbers (bar and overlay) ---------------------------------- */
    $$('.js-scrub').forEach((scrubber) => {
      const ratioFromEvent = (event) => {
        const rect = scrubber.getBoundingClientRect();
        const x = (event.touches?.[0]?.clientX ?? event.clientX) - rect.left;
        return clamp(x / rect.width, 0, 1);
      };
      scrubber.addEventListener('pointerdown', (event) => {
        if (!Player.current) return;
        Player.seeking = true;
        paintProgress(ratioFromEvent(event));
        scrubber.setPointerCapture(event.pointerId);
      });
      scrubber.addEventListener('pointermove', (event) => {
        if (Player.seeking) paintProgress(ratioFromEvent(event));
      });
      scrubber.addEventListener('pointerup', (event) => {
        if (!Player.seeking) return;
        Player.seeking = false;
        Player.seekToRatio(ratioFromEvent(event));
      });
      scrubber.addEventListener('keydown', (event) => {
        if (!Player.current) return;
        const step = event.shiftKey ? 30 : 5;
        if (event.key === 'ArrowRight') { Player.seekBy(step); event.preventDefault(); }
        if (event.key === 'ArrowLeft') { Player.seekBy(-step); event.preventDefault(); }
      });
    });

    /* --- dialog ------------------------------------------------------- */
    $('#modalOk').addEventListener('click', () => Modal.submit());
    $$('[data-modal-cancel]').forEach((el) => el.addEventListener('click', () => Modal.close(null)));
    $('#modalInput').addEventListener('keydown', (event) => {
      if (event.key === 'Enter') { event.preventDefault(); Modal.submit(); }
      if (event.key === 'Escape') { event.preventDefault(); Modal.close(null); }
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !$('#modal').hidden) Modal.close(null);
    });

    /* --- queue drawer, now playing ------------------------------------ */
    $('#closeQueue').addEventListener('click', () => { $('#queueDrawer').hidden = true; });
    $('#clearQueue').addEventListener('click', () => Player.clearUpcoming());
    $('#npClose').addEventListener('click', () => closeNp());
    $('#npBackdrop').addEventListener('click', () => closeNp());
    $$('.np__tab').forEach((tab) => tab.addEventListener('click', () => {
      npTab = tab.dataset.tab;
      syncNpTabs();
      renderNpPanel();
    }));

    /* --- search ------------------------------------------------------- */
    const input = $('#searchInput');
    input.addEventListener('input', () => {
      const query = input.value.trim();
      $('#searchClear').hidden = !query;
      clearTimeout(suggestTimer);
      suggestTimer = setTimeout(() => runSuggest(query), 220);
    });
    input.addEventListener('focus', () => {
      if (input.value.trim().length >= 2) runSuggest(input.value.trim());
    });
    input.addEventListener('keydown', (event) => {
      const items = $$('.suggest__item');
      if (event.key === 'ArrowDown' && items.length) {
        suggestCursor = (suggestCursor + 1) % items.length;
      } else if (event.key === 'ArrowUp' && items.length) {
        suggestCursor = (suggestCursor - 1 + items.length) % items.length;
      } else if (event.key === 'Escape') {
        hideSuggest();
        input.blur();
        return;
      } else {
        return;
      }
      event.preventDefault();
      items.forEach((item, i) => item.classList.toggle('is-cursor', i === suggestCursor));
      items[suggestCursor]?.scrollIntoView({ block: 'nearest' });
    });
    $('#searchForm').addEventListener('submit', (event) => {
      event.preventDefault();
      const items = $$('.suggest__item');
      if (suggestCursor >= 0 && items[suggestCursor]) {
        items[suggestCursor].click();
        return;
      }
      const query = input.value.trim();
      if (query) {
        hideSuggest();
        input.blur();
        location.hash = `#/search/${encodeURIComponent(query)}`;
      }
    });
    $('#searchClear').addEventListener('click', () => {
      input.value = '';
      $('#searchClear').hidden = true;
      hideSuggest();
      input.focus();
    });
    document.addEventListener('click', (event) => {
      if (!event.target.closest('#searchForm')) hideSuggest();
    });

    /* --- history nav -------------------------------------------------- */
    $('#backBtn').addEventListener('click', () => history.back());
    $('#fwdBtn').addEventListener('click', () => history.forward());

    /* --- sticky topbar ------------------------------------------------ */
    view.addEventListener('scroll', () => {
      $('#topbar').classList.toggle('is-stuck', view.scrollTop > 16);
    }, { passive: true });

    /* --- keyboard shortcuts ------------------------------------------- */
    document.addEventListener('keydown', (event) => {
      // Never hijack browser or OS shortcuts. Without this, Ctrl+R toggled
      // repeat on its way to reloading the page and Ctrl+L liked the track on
      // its way to the address bar.
      if (event.ctrlKey || event.metaKey || event.altKey) return;

      const el = event.target;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable) return;

      // Space and Enter belong to whatever control has focus.
      const focusedControl = el.closest?.('button, a[href], [role="switch"], [role="slider"]');
      if (focusedControl && (event.key === ' ' || event.key === 'Enter')) return;

      // Normalise single characters so Shift and Caps Lock cannot break the
      // letter shortcuts. event.key reports "S" for both Shift+s and caps-on s.
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      const big = event.shiftKey;

      switch (key) {
        case ' ':
        case 'k':
          event.preventDefault();
          Player.toggle();
          break;
        case 'n': Player.next(true); break;
        case 'p': Player.prev(); break;
        case 'l':
          if (Player.current) {
            const now = Store.toggleLike(Player.current);
            $('#likeBtn').setAttribute('aria-pressed', String(now));
            refreshLikeButtons(Player.current.id);
          }
          break;
        case 'm': $('#muteBtn').click(); break;
        case 's': $('#shuffleBtn').click(); break;
        case 'r': $('#repeatBtn').click(); break;
        case 'q': $('#queueBtn').click(); break;
        case '/':
          event.preventDefault();
          $('#searchInput').focus();
          break;
        case 'escape':
        case 'Escape':
          if (!$('#np').hidden) closeNp();
          else if (!$('#queueDrawer').hidden) $('#queueDrawer').hidden = true;
          else closeMenu();
          break;

        // Seeking works on its own. Shift makes the jump bigger, it is not
        // required, which is what it used to be.
        case 'ArrowRight':
          if (!Player.current) return;
          event.preventDefault();
          Player.seekBy(big ? 30 : 5);
          break;
        case 'ArrowLeft':
          if (!Player.current) return;
          event.preventDefault();
          Player.seekBy(big ? -30 : -5);
          break;

        // Volume only takes the arrows once something is loaded, so the page
        // still scrolls by keyboard before you start playing.
        case 'ArrowUp':
          if (!Player.current) return;
          event.preventDefault();
          nudgeVolume(big ? 0.1 : 0.05);
          break;
        case 'ArrowDown':
          if (!Player.current) return;
          event.preventDefault();
          nudgeVolume(big ? -0.1 : -0.05);
          break;
        default: break;
      }
    });

    window.addEventListener('hashchange', route);

    /* --- connectivity ------------------------------------------------- */
    const showOffline = () => {
      if ($('#offlineBanner')) return;
      const node = document.createElement('div');
      node.className = 'offline';
      node.id = 'offlineBanner';
      node.innerHTML = `
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18m0 2a7 7 0 0 1 5.6 11.2L6.8 6.4A7 7 0 0 1 12 5M5.4 7.8 16.2 18.6A7 7 0 0 1 5.4 7.8"/></svg>
        <span>You are offline. Playback and browsing need a connection.</span>`;
      document.body.appendChild(node);
    };
    window.addEventListener('offline', showOffline);
    window.addEventListener('online', () => {
      $('#offlineBanner')?.remove();
      toast('Back online');
      Feed.invalidate();
    });
    if (!navigator.onLine) showOffline();
  }

  function syncNpTabs() {
    $$('.np__tab').forEach((tab) => {
      const active = tab.dataset.tab === npTab;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', String(active));
    });
  }

  /** Switch bitrate, keeping the current position. */
  function applyQuality(quality) {
    Store.prefs.quality = quality;
    Store.savePrefs();
    $('#qualityTag').textContent = quality.replace('kbps', '');
    toast(`Streaming at ${quality.replace('kbps', ' kbps')}`);

    if (!Player.current) return;
    const selectedStream = pickStream(Player.current, quality);
    const url = selectedStream.url;
    Player.servedQuality = selectedStream.quality;
    showServedQuality(Player.current, selectedStream.quality);
    if (!url || url === audio.src) return;

    // Seeking has to wait for the new source to report its duration, otherwise
    // the assignment lands on an element that is still in HAVE_NOTHING.
    const at = audio.currentTime;
    const wasPlaying = !audio.paused;
    const resume = () => {
      audio.removeEventListener('loadedmetadata', resume);
      try { audio.currentTime = at; } catch { /* not seekable yet */ }
      if (wasPlaying) audio.play().catch(() => {});
    };
    audio.addEventListener('loadedmetadata', resume);
    audio.src = url;
  }

  function refreshLikeButtons(songId) {
    const liked = Store.isLiked(songId);
    $$(`[data-like="${songId}"]`).forEach((btn) => btn.setAttribute('aria-pressed', String(liked)));
    if (Player.current?.id === songId) {
      $$('.js-like').forEach((btn) => btn.setAttribute('aria-pressed', String(liked)));
    }
  }

  async function startRadio(songId) {
    toast('Building your station');
    try {
      const station = await API.radio(songId, 40);
      const songs = [station.seed, ...(station.items || [])].filter(Boolean);
      if (!songs.length) throw new Error('empty');
      Player.play(songs, 0, { label: `${station.seed?.name || 'Station'} station` });
      toast(`Station from ${station.seed?.name || 'that track'}`);
    } catch {
      toast('Could not build a station for that track');
    }
  }

  async function startArtistRadio(artistId) {
    toast('Building the artist station');
    try {
      const station = await API.artistRadio(artistId, 40);
      if (!station.items?.length) throw new Error('empty');
      Player.play(station.items, 0, { label: `${station.meta?.artist || 'Artist'} station` });
    } catch {
      toast('Could not build that station');
    }
  }

  /* ====================================================================== */
  /* Boot                                                                   */
  /* ====================================================================== */

  installArtworkFallbacks();
  Player.init();
  wire();
  renderSidebarCounts();
  renderPlaylistList();
  renderTasteCard();
  renderQueue();
  if (!location.hash) location.hash = '#/home';
  route();
})();
