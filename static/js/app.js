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
  function art(item, size = 500) {
    const list = item?.image;
    if (typeof list === 'string') return list;
    if (!Array.isArray(list) || !list.length) return '';
    const want = `${size}x${size}`;
    const exact = list.find((i) => i.quality === want);
    return (exact || list[list.length - 1]).url || '';
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

  function streamUrl(song, preferred) {
    const urls = song?.downloadUrl;
    if (!Array.isArray(urls) || !urls.length) return '';
    const byQuality = new Map(urls.map((u) => [u.quality, u.url]));
    const order = preferred
      ? [preferred, ...QUALITY_ORDER.filter((q) => q !== preferred)]
      : QUALITY_ORDER;
    for (const quality of order) {
      if (byQuality.get(quality)) return byQuality.get(quality);
    }
    return urls[urls.length - 1].url;
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
    prefs: Object.assign(
      { volume: 0.85, muted: false, quality: '320kbps', repeat: 'off', shuffle: false, language: 'hindi', autoplay: true },
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
    album(id) { return this.get(`/api/albums?id=${encodeURIComponent(id)}`); },
    playlist(id, limit = 100) { return this.get(`/api/playlists?id=${encodeURIComponent(id)}&limit=${limit}`); },
    artist(id) { return this.get(`/api/artists/${encodeURIComponent(id)}?songCount=30&albumCount=20`); },
    songs(ids) { return this.get(`/api/songs?ids=${encodeURIComponent(ids.join(','))}`); },
    lyrics(id) { return this.get(`/api/songs/${encodeURIComponent(id)}/lyrics`); },
    similar(ids, limit = 16) { return this.post('/api/similar', { ids, limit }); },
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
          return data;
        })
        .finally(() => { this.inflight = null; });
      return this.inflight;
    },
  };

  /* ====================================================================== */
  /* Toasts                                                                 */
  /* ====================================================================== */

  const ICON_CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.6 16.6 5 12l1.4-1.4 3.2 3.2 8-8L19 7.2z"/></svg>';

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

  function songCard(song, { badge } = {}) {
    const reason = song.recommendation?.reason;
    return `
      <article class="card" data-open-song="${esc(song.id)}">
        <div class="card__art">
          <img loading="lazy" src="${esc(art(song, 500))}" alt="">
          ${badge ? `<span class="card__badge">${esc(badge)}</span>` : ''}
          <button class="card__play" data-play-song="${esc(song.id)}" aria-label="Play ${esc(song.name)}">${ICON_PLAY}</button>
        </div>
        <div class="card__title">${esc(song.name)}</div>
        <div class="card__sub">${esc(artistLine(song))}</div>
        ${reason ? `<div style="margin-top:7px"><span class="reason-pill"><span>${esc(reason)}</span></span></div>` : ''}
      </article>`;
  }

  function entityCard(item, kind) {
    const round = kind === 'artist';
    const route = kind === 'artist' ? 'artist' : kind === 'playlist' ? 'playlist' : 'album';
    const sub = item.subtitle || (item.songCount ? plural(item.songCount, 'song') : (item.year || ''));
    return `
      <article class="card ${round ? 'card--round' : ''}" data-goto="#/${route}/${esc(item.id)}">
        <div class="card__art">
          <img loading="lazy" src="${esc(art(item, 500))}" alt="">
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
          ${opts.hideArt ? '' : `<img class="track__art" loading="lazy" src="${esc(art(song, 150))}" alt="">`}
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
          <button class="icon-btn" data-menu="${esc(song.id)}" aria-label="More options">${ICON_MORE}</button>
        </div>
      </div>`;
  }

  function trackList(songs, { label, hideArt } = {}) {
    if (!songs?.length) return '';
    const key = registerList(songs, label);
    return `
      <div class="tracks" data-list-root="${key}">
        <div class="tracks__head">
          <span>#</span><span>Title</span><span>Album</span><span>Why</span><span>Time</span><span></span>
        </div>
        ${songs.map((song, i) => trackRow(song, i, key, { hideArt })).join('')}
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

  const audio = $('#audio');

  const Player = {
    queue: [],
    order: [],
    pos: -1,
    current: null,
    playedRatio: 0,
    loggedPlay: false,
    autoplayPending: false,
    seeking: false,

    init() {
      audio.volume = Store.prefs.muted ? 0 : Store.prefs.volume;
      audio.muted = !!Store.prefs.muted;
      $('#volume').value = Math.round(Store.prefs.volume * 100);
      setVolumeFill(Store.prefs.volume * 100);
      $('#muteBtn').classList.toggle('is-muted', !!Store.prefs.muted);
      $('#repeatBtn').dataset.mode = Store.prefs.repeat;
      $('#shuffleBtn').classList.toggle('is-on', !!Store.prefs.shuffle);
      $('#shuffleBtn').setAttribute('aria-pressed', String(!!Store.prefs.shuffle));
      $('#qualityTag').textContent = Store.prefs.quality.replace('kbps', '');

      audio.addEventListener('loadedmetadata', () => {
        $('#timeTotal').textContent = fmtTime(audio.duration || this.current?.duration || 0);
      });
      audio.addEventListener('timeupdate', () => this.onTime());
      audio.addEventListener('ended', () => this.onEnded());
      audio.addEventListener('play', () => setPlayerState('playing'));
      audio.addEventListener('pause', () => {
        if (!audio.ended) setPlayerState('paused');
      });
      audio.addEventListener('waiting', () => setPlayerState('loading'));
      audio.addEventListener('playing', () => setPlayerState('playing'));
      audio.addEventListener('error', () => this.onError());
    },

    /** Play a list of songs starting at an index. */
    async play(songs, index = 0, meta = {}) {
      const playable = (songs || []).filter((s) => s?.id);
      if (!playable.length) {
        toast('Nothing playable in there');
        return;
      }
      remember(playable);
      this.queue = playable;
      this.contextLabel = meta.label || '';
      this.rebuildOrder(index);
      await this.load(this.order.indexOf(index) >= 0 ? this.order.indexOf(index) : 0, true);
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
      this.pos = orderPos;
      const song = this.queue[this.order[orderPos]];
      if (!song) return;

      this.current = song;
      this.playedRatio = 0;
      this.loggedPlay = false;

      const url = streamUrl(song, Store.prefs.quality);
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
      this.topUpIfNeeded();
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
      if (this.pos + 1 < this.order.length) return this.load(this.pos + 1);
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

    enqueue(song, { next = false } = {}) {
      if (!song?.id) return;
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
      if (!this.seeking) {
        $('#progressFill').style.width = `${ratio * 100}%`;
        $('#progressKnob').style.left = `${ratio * 100}%`;
        $('#scrubber').setAttribute('aria-valuenow', String(Math.round(ratio * 100)));
      }
      $('#timeNow').textContent = fmtTime(audio.currentTime);

      // A play only counts once we are past the intro.
      if (!this.loggedPlay && audio.currentTime > 12) {
        this.loggedPlay = true;
        Store.logEvent(this.current, 'play');
      }
      if (ratio > 0.82 && this.pos + 2 >= this.order.length) this.topUpIfNeeded();
    },

    onEnded() {
      if (this.current) {
        Store.logEvent(this.current, this.playedRatio > 0.9 ? 'complete' : 'play');
      }
      if (Store.prefs.repeat === 'one') {
        audio.currentTime = 0;
        audio.play().catch(() => {});
        return;
      }
      this.next();
    },

    onError() {
      if (!this.current) return;
      // Fall back to a lower bitrate before giving up on the track.
      const current = audio.src;
      for (const quality of QUALITY_ORDER) {
        const url = streamUrl(this.current, quality);
        if (url && url !== current) {
          audio.src = url;
          audio.play().catch(() => {});
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
  };

  /** Reason pills keep their label in a child span so it can ellipsize. */
  function setPill(pill, text) {
    if (!pill) return;
    pill.hidden = !text;
    if (text) pill.firstElementChild.textContent = text;
  }

  function setPlayerState(state) {
    $('#player').dataset.state = state;
    const playing = state === 'playing';
    $('#playBtn').setAttribute('aria-label', playing ? 'Pause' : 'Play');
    $('#playBtn').title = playing ? 'Pause' : 'Play';
    document.body.classList.toggle('is-paused', !playing);
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = playing ? 'playing' : 'paused';
    }
  }

  function setVolumeFill(percent) {
    $('#volume').style.setProperty('--vol', `${percent}%`);
  }

  function paintNowPlaying(song) {
    const cover = art(song, 500);
    $('#playerImg').src = cover;
    $('#playerImg').alt = song.name || '';
    $('#playerTitle').textContent = song.name || '';
    $('#playerTitle').href = song.album?.id ? `#/album/${song.album.id}` : '#/home';
    $('#playerArtist').textContent = artistLine(song);
    $('#likeBtn').setAttribute('aria-pressed', String(Store.isLiked(song.id)));

    const reason = song.recommendation?.reason;
    setPill($('#reasonPill'), reason);

    $('#npImg').src = cover;
    $('#npTitle').textContent = song.name || '';
    $('#npArtist').textContent = artistLine(song);
    setPill($('#npReason'), reason);

    document.documentElement.style.setProperty('--hue', String(hueOf(song.id)));
    document.title = `${song.name} · ${artistLine(song)} | MusicArea`;
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
          <img loading="lazy" src="${esc(art(song, 150))}" alt="">
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
    Viz.start();
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
      `<i style="height:${20 + ((i * 37) % 70)}%;animation-delay:-${(i * 90) % 1100}ms"></i>`).join('');
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
            <img loading="lazy" src="${esc(art(item, 150))}" alt="">
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

    ensure() {
      if (this.ctx || this.failed) return;
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) throw new Error('no audio context');
        this.ctx = new AudioCtx();
        const source = this.ctx.createMediaElementSource(audio);
        this.analyser = this.ctx.createAnalyser();
        this.analyser.fftSize = 128;
        this.analyser.smoothingTimeConstant = 0.78;
        source.connect(this.analyser);
        this.analyser.connect(this.ctx.destination);
        this.data = new Uint8Array(this.analyser.frequencyBinCount);
      } catch {
        // Falls back to the CSS keyframe bars. Never let this break audio.
        this.failed = true;
        this.ctx = null;
      }
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
          bar.style.height = `${clamp(8 + (value / 255) * 100, 8, 100)}%`;
          bar.style.animation = 'none';
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

  function setView(html) {
    view.innerHTML = html;
    view.scrollTop = 0;
    markCurrentRows();
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
      const hero = profile && !profile.coldStart
        ? `
          <section class="hero">
            <span class="hero__eyebrow">${ICON_SPARK} Your mix is ready</span>
            <h1>Music that keeps<br>learning what you love</h1>
            <p>Built from ${plural(profile.events, 'listening signal')} across ${plural(profile.topArtists.length, 'artist')}. Every pick below tells you why it is there.</p>
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
          </section>`
        : `
          <section class="hero">
            <span class="hero__eyebrow">${ICON_SPARK} Welcome to MusicArea</span>
            <h1>Press play once.<br>The feed does the rest.</h1>
            <p>MusicArea studies what you actually finish, skip and repeat, then builds a feed from it. No sign up, nothing leaves your device: your taste profile lives in this browser.</p>
            <div class="hero__actions">
              <button class="btn btn--primary btn--lg" data-play-shelf="${esc(feedData?.rows?.[0]?.id || 'trending')}">${ICON_PLAY} Start listening</button>
              <a class="btn btn--outline btn--lg" href="#/browse">Browse the catalogue</a>
            </div>
          </section>`;

      const rows = [];
      (feedData?.rows || []).forEach((row) => rows.push(shelf(row)));
      if (browseData) {
        rows.push(moodStrip(browseData.moods));
        (browseData.rows || []).forEach((row) => rows.push(shelf(row)));
      }

      setView(hero + rows.join(''));
      Home.feed = feedData;
    },

    async browse() {
      setView(`${skeletonShelf('Loading the catalogue')}${skeletonShelf('Charts')}`);
      const data = await API.browse(Store.prefs.language).catch(() => null);
      if (!data) {
        setView(emptyState('Browse is unavailable', 'The catalogue service did not respond. Try again shortly.'));
        return;
      }
      const languages = data.languages.map((lang) => `
        <button class="chip ${lang === Store.prefs.language ? 'is-active' : ''}" data-language="${esc(lang)}">${esc(cap(lang))}</button>`).join('');
      setView(`
        <section class="section">
          <div class="section__head"><div><h2>Browse</h2><p>Pick a language and dig in</p></div></div>
          <div class="chip-row">${languages}</div>
        </section>
        ${moodStrip(data.moods)}
        ${(data.rows || []).map(shelf).join('')}`);
    },

    async search(query) {
      if (!query) {
        setView(`
          <section class="section">
            <div class="section__head"><div><h2>Search</h2><p>Find any song, album, artist or playlist</p></div></div>
          </section>
          ${moodStrip(MOODS_FALLBACK)}`);
        $('#searchInput').focus();
        return;
      }
      $('#searchInput').value = query;
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

    async album(id) {
      setView(detailSkeleton());
      const album = await API.album(id).catch(() => null);
      if (!album) {
        setView(emptyState('Album not found', 'That album could not be loaded.'));
        return;
      }
      const songs = album.songs || [];
      remember(songs);
      document.documentElement.style.setProperty('--hue', String(hueOf(album.id)));
      const listKey = registerList(songs, album.name);
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
      const personalised = data.meta?.personalised;
      const blurb = personalised
        ? `${plural(data.meta.pool, 'track')} pulled for this mood, then ordered by how well each one fits your listening.`
        : `${plural(data.items.length, 'track')} for this mood, in the catalogue's own order. Play a few things and this set reorders around your taste.`;
      setView(`
        <section class="hero">
          <span class="hero__eyebrow">${ICON_SPARK} Mood</span>
          <h1>${esc(data.mood.name)}</h1>
          <p>${esc(blurb)}</p>
          <div class="hero__actions">
            <button class="btn btn--primary btn--lg" data-play-list="${listKey}">${ICON_PLAY} Play</button>
            <button class="btn btn--outline btn--lg" data-shuffle-list="${listKey}">Shuffle</button>
          </div>
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
        ${trackList(songs, { label: 'Liked songs' })}`);
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
            </div>
          </div>
          ${trackList(songs, { label: 'Recently played' })}
        </section>`);
    },

    library() {
      const lists = Store.playlists;
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
              <div class="card__art shelf-link__art--liked" style="display:grid;place-items:center;border-radius:var(--r-sm)">
                <svg viewBox="0 0 24 24" style="width:46px;height:46px" aria-hidden="true"><path d="M12 20.7 4.6 13.6a4.9 4.9 0 0 1 7-6.9l.4.4.4-.4a4.9 4.9 0 0 1 7 6.9z"/></svg>
              </div>
              <div class="card__title">Liked songs</div>
              <div class="card__sub">${plural(Store.liked.length, 'song')}</div>
            </article>
            <article class="card" data-goto="#/recent">
              <div class="card__art shelf-link__art--recent" style="display:grid;place-items:center;border-radius:var(--r-sm)">
                <svg viewBox="0 0 24 24" style="width:46px;height:46px" aria-hidden="true"><path d="M12 3a9 9 0 1 0 9 9h-2a7 7 0 1 1-7-7v4l5-4-5-4z"/></svg>
              </div>
              <div class="card__title">Recently played</div>
              <div class="card__sub">${plural(Store.recent.length, 'song')}</div>
            </article>
            ${lists.map((list) => `
              <article class="card" data-goto="#/list/${esc(list.id)}">
                <div class="card__art shelf-link__art--custom" style="display:grid;place-items:center;border-radius:var(--r-sm)">
                  <svg viewBox="0 0 24 24" style="width:44px;height:44px" aria-hidden="true"><path d="M4 6h11v2H4zm0 4h11v2H4zm0 4h7v2H4zm13-6 4 3-4 3z"/></svg>
                </div>
                <div class="card__title">${esc(list.name)}</div>
                <div class="card__sub">${plural(list.songs.length, 'song')}</div>
              </article>`).join('')}
          </div>
        </section>
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
              <button class="btn btn--outline" data-delete-list="${esc(list.id)}">Delete playlist</button>
            </div>
          </div>
        </header>
        ${trackList(list.songs, { label: list.name })}`);
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
        <section class="hero">
          <span class="hero__eyebrow">${ICON_SPARK} Taste profile</span>
          <h1>What the algorithm thinks of you</h1>
          <p>Derived from ${plural(profile.events, 'signal')} in this browser. Recent listening counts for more: the weighting halves every three weeks.</p>
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

  const Home = { feed: null };

  const MOODS_FALLBACK = [
    { id: 'romance', name: 'Romance', hue: 336 }, { id: 'party', name: 'Party', hue: 24 },
    { id: 'chill', name: 'Chill', hue: 190 }, { id: 'sad', name: 'Heartbreak', hue: 220 },
    { id: 'workout', name: 'Workout', hue: 8 }, { id: 'retro', name: 'Retro Gold', hue: 268 },
    { id: 'indie', name: 'Indie', hue: 158 }, { id: 'focus', name: 'Focus', hue: 210 },
  ];

  function moodStrip(moods) {
    const list = moods?.length ? moods : MOODS_FALLBACK;
    return `
      <section class="section">
        <div class="section__head"><div><h2>Moods</h2><p>Ready made sets, reordered around what you play</p></div></div>
        <div class="shelf" style="grid-auto-columns:190px">
          ${list.map((mood) => `
            <a class="card" href="#/mood/${esc(mood.id)}" style="background:linear-gradient(135deg, hsl(${mood.hue} 70% 34%), hsl(${(mood.hue + 40) % 360} 66% 24%));border-color:transparent">
              <div style="aspect-ratio:1.5;display:flex;align-items:flex-end;padding:6px">
                <div class="card__title" style="font-size:17px;letter-spacing:-.4px">${esc(mood.name)}</div>
              </div>
            </a>`).join('')}
        </div>
      </section>`;
  }

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

  function renderTasteCard() {
    // Mirrors the server side profile strength: positive weight over a target.
    const events = Store.history.filter((e) => !['skip', 'dislike'].includes(e.event));
    const strength = clamp(events.length / 40, 0, 1);
    $('#tasteBar').style.width = `${Math.round(strength * 100)}%`;
    $('#tasteHint').textContent = events.length
      ? `${plural(events.length, 'signal')} learned`
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
          <img loading="lazy" src="${esc(art(item, 150))}" alt="">
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
      $('#shuffleBtn').classList.add('is-on');
      $('#shuffleBtn').setAttribute('aria-pressed', 'true');
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
          const name = prompt('Playlist name', 'New playlist');
          if (name) { const list = Store.createPlaylist(name.trim()); Store.addToPlaylist(list.id, song); toast(`Created ${list.name}`); }
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
        const name = prompt('Playlist name', 'New playlist');
        if (name?.trim()) {
          const list = Store.createPlaylist(name.trim());
          location.hash = `#/list/${list.id}`;
          toast(`Created ${list.name}`);
        }
        return;
      }

      const deleteList = target.closest('[data-delete-list]');
      if (deleteList) {
        if (confirm('Delete this playlist?')) {
          Store.deletePlaylist(deleteList.dataset.deleteList);
          location.hash = '#/library';
        }
        return;
      }

      if (target.closest('#clearData')) {
        if (confirm('Clear all listening data? Recommendations reset to a cold start.')) {
          Store.clearHistory();
          toast('Listening data cleared');
          route();
        }
      }
    });

    /* --- player controls --------------------------------------------- */
    $('#playBtn').addEventListener('click', () => Player.toggle());
    $('#nextBtn').addEventListener('click', () => Player.next(true));
    $('#prevBtn').addEventListener('click', () => Player.prev());

    $('#shuffleBtn').addEventListener('click', () => {
      Store.prefs.shuffle = !Store.prefs.shuffle;
      Store.savePrefs();
      $('#shuffleBtn').classList.toggle('is-on', Store.prefs.shuffle);
      $('#shuffleBtn').setAttribute('aria-pressed', String(Store.prefs.shuffle));
      if (Player.queue.length) {
        const currentQueueIndex = Player.order[Player.pos];
        Player.rebuildOrder(currentQueueIndex);
        Player.pos = 0;
        renderQueue();
      }
      toast(Store.prefs.shuffle ? 'Shuffle on' : 'Shuffle off');
    });

    $('#repeatBtn').addEventListener('click', () => {
      const modes = ['off', 'all', 'one'];
      const next = modes[(modes.indexOf(Store.prefs.repeat) + 1) % modes.length];
      Store.prefs.repeat = next;
      Store.savePrefs();
      $('#repeatBtn').dataset.mode = next;
      toast(next === 'off' ? 'Repeat off' : next === 'all' ? 'Repeat queue' : 'Repeat one');
    });

    $('#likeBtn').addEventListener('click', () => {
      if (!Player.current) return;
      const now = Store.toggleLike(Player.current);
      $('#likeBtn').setAttribute('aria-pressed', String(now));
      refreshLikeButtons(Player.current.id);
      toast(now ? 'Added to liked songs' : 'Removed from liked songs');
    });

    $('#volume').addEventListener('input', (event) => {
      const value = Number(event.target.value) / 100;
      Store.prefs.volume = value;
      Store.prefs.muted = value === 0;
      Store.savePrefs();
      audio.muted = false;
      audio.volume = value;
      setVolumeFill(value * 100);
      $('#muteBtn').classList.toggle('is-muted', value === 0);
    });

    $('#muteBtn').addEventListener('click', () => {
      Store.prefs.muted = !Store.prefs.muted;
      Store.savePrefs();
      audio.muted = Store.prefs.muted;
      $('#muteBtn').classList.toggle('is-muted', Store.prefs.muted);
    });

    $('#quality').addEventListener('click', () => {
      const order = ['320kbps', '160kbps', '96kbps'];
      const next = order[(order.indexOf(Store.prefs.quality) + 1) % order.length];
      Store.prefs.quality = next;
      Store.savePrefs();
      $('#qualityTag').textContent = next.replace('kbps', '');
      toast(`Streaming at ${next}`);
      if (Player.current && !audio.paused) {
        const at = audio.currentTime;
        audio.src = streamUrl(Player.current, next);
        audio.currentTime = at;
        audio.play().catch(() => {});
      }
    });

    /* --- scrubber ----------------------------------------------------- */
    const scrubber = $('#scrubber');
    const ratioFromEvent = (event) => {
      const rect = scrubber.getBoundingClientRect();
      const x = (event.touches?.[0]?.clientX ?? event.clientX) - rect.left;
      return clamp(x / rect.width, 0, 1);
    };
    const preview = (ratio) => {
      $('#progressFill').style.width = `${ratio * 100}%`;
      $('#progressKnob').style.left = `${ratio * 100}%`;
    };
    scrubber.addEventListener('pointerdown', (event) => {
      if (!Player.current) return;
      Player.seeking = true;
      preview(ratioFromEvent(event));
      scrubber.setPointerCapture(event.pointerId);
    });
    scrubber.addEventListener('pointermove', (event) => {
      if (Player.seeking) preview(ratioFromEvent(event));
    });
    scrubber.addEventListener('pointerup', (event) => {
      if (!Player.seeking) return;
      Player.seeking = false;
      Player.seekToRatio(ratioFromEvent(event));
    });
    scrubber.addEventListener('keydown', (event) => {
      const step = event.shiftKey ? 30 : 5;
      if (event.key === 'ArrowRight') { audio.currentTime += step; event.preventDefault(); }
      if (event.key === 'ArrowLeft') { audio.currentTime -= step; event.preventDefault(); }
    });

    /* --- queue drawer, now playing ------------------------------------ */
    $('#queueBtn').addEventListener('click', () => {
      const drawer = $('#queueDrawer');
      drawer.hidden = !drawer.hidden;
      if (!drawer.hidden) renderQueue();
    });
    $('#closeQueue').addEventListener('click', () => { $('#queueDrawer').hidden = true; });
    $('#clearQueue').addEventListener('click', () => Player.clearUpcoming());
    $('#playerArt').addEventListener('click', () => openNp());
    $('#npClose').addEventListener('click', () => closeNp());
    $('#lyricsBtn').addEventListener('click', () => {
      npTab = 'lyrics';
      syncNpTabs();
      openNp();
    });
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
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName);
      if (typing) return;
      switch (event.key) {
        case ' ': event.preventDefault(); Player.toggle(); break;
        case 'k': Player.toggle(); break;
        case 'j': case 'ArrowDown': if (event.altKey) Player.next(true); break;
        case 'n': Player.next(true); break;
        case 'p': Player.prev(); break;
        case 'l': if (Player.current) { const now = Store.toggleLike(Player.current); $('#likeBtn').setAttribute('aria-pressed', String(now)); refreshLikeButtons(Player.current.id); } break;
        case 'm': $('#muteBtn').click(); break;
        case 's': $('#shuffleBtn').click(); break;
        case 'r': $('#repeatBtn').click(); break;
        case 'q': $('#queueBtn').click(); break;
        case '/': event.preventDefault(); $('#searchInput').focus(); break;
        case 'Escape': if (!$('#np').hidden) closeNp(); break;
        case 'ArrowRight': if (event.shiftKey) audio.currentTime += 10; break;
        case 'ArrowLeft': if (event.shiftKey) audio.currentTime -= 10; break;
        default: break;
      }
    });

    window.addEventListener('hashchange', route);
  }

  function syncNpTabs() {
    $$('.np__tab').forEach((tab) => {
      const active = tab.dataset.tab === npTab;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', String(active));
    });
  }

  function refreshLikeButtons(songId) {
    const liked = Store.isLiked(songId);
    $$(`[data-like="${songId}"]`).forEach((btn) => btn.setAttribute('aria-pressed', String(liked)));
    if (Player.current?.id === songId) $('#likeBtn').setAttribute('aria-pressed', String(liked));
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

  Player.init();
  wire();
  renderSidebarCounts();
  renderPlaylistList();
  renderTasteCard();
  renderQueue();
  if (!location.hash) location.hash = '#/home';
  route();
})();
