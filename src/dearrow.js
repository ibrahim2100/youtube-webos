// DeArrow: replaces clickbait titles and thumbnails on video tiles with the
// community-submitted ones (https://dearrow.ajay.app). Works on the page DOM:
// YouTube re-uses its tile elements, so everything is re-checked on change.
import { configRead, configAddChangeListener } from './config';

const BRANDING_API = 'https://sponsor.ajay.app/api/branding?videoID=';
const THUMB_API = 'https://dearrow-thumb.ajay.app/api/v1/getThumbnail?videoID=';
const CACHE_KEY = 'king-dearrow-cache';
const TTL_MS = 7 * 24 * 3600 * 1000;
const MAX_ENTRIES = 600;
const MAX_PARALLEL = 3;

// Verification counters (inspector: window.__kingDeArrow).
const counters = { titles: 0, thumbs: 0, fetched: 0, cached: 0, errors: 0 };
window.__kingDeArrow = counters;

let cache = loadCache();
const inflight = new Set();
const queue = [];
let running = 0;
let observer = null;
let scanTimer = null;
let saveTimer = null;

function loadCache() {
  try {
    return JSON.parse(window.localStorage.getItem(CACHE_KEY) || '{}') || {};
  } catch {
    return {};
  }
}

function saveCacheSoon() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const ids = Object.keys(cache);
    if (ids.length > MAX_ENTRIES) {
      ids
        .sort((a, b) => cache[a].f - cache[b].f)
        .slice(0, ids.length - MAX_ENTRIES)
        .forEach((id) => {
          delete cache[id];
        });
    }
    try {
      window.localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    } catch {
      // storage is optional
    }
  }, 2000);
}

/** Pulls the usable title/thumbnail out of a DeArrow branding response. */
export function pickBranding(data) {
  const usable = (x) => x && !x.original && (x.locked || x.votes >= 0);
  const title = data && data.titles && data.titles[0];
  const thumb = data && data.thumbnails && data.thumbnails[0];
  let t = null;
  if (usable(title) && typeof title.title === 'string') {
    // ">" in front of a word is DeArrow's "keep my casing" marker.
    t = title.title.replace(/(^|\s)>(?=\S)/g, '$1').trim() || null;
  }
  const ts = usable(thumb) && thumb.timestamp != null ? thumb.timestamp : null;
  return { t, ts };
}

function pump() {
  while (running < MAX_PARALLEL && queue.length) {
    const id = queue.shift();
    running++;
    fetch(BRANDING_API + id)
      .then((resp) => {
        if (resp.status === 404) return { t: null, ts: null }; // no submissions
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        return resp.json().then(pickBranding);
      })
      .then((entry) => {
        cache[id] = { t: entry.t, ts: entry.ts, f: Date.now() };
        counters.fetched++;
        saveCacheSoon();
      })
      .catch(() => {
        counters.errors++;
      })
      .then(() => {
        running--;
        inflight.delete(id);
        scheduleScan();
        pump();
      });
  }
}

function request(id) {
  if (inflight.has(id)) return;
  inflight.add(id);
  queue.push(id);
  pump();
}

const ID_RE = /(?:\/vi(?:_webp)?\/|videoID=)([\w-]{11})(?:[/&"')]|$)/;

function videoIdOf(thumbEl) {
  const m = ID_RE.exec(thumbEl.style.backgroundImage || '');
  return m ? m[1] : null;
}

function processTile(tile) {
  const thumbEl = tile.querySelector('ytlr-thumbnail-details');
  if (!thumbEl) return;
  const id = videoIdOf(thumbEl);
  if (!id) return;

  let st = tile.__king;
  if (!st || st.id !== id) {
    st = tile.__king = { id, origTitle: null, origBg: null };
  }

  const entry = cache[id];
  if (!entry || Date.now() - entry.f > TTL_MS) {
    if (!inflight.has(id)) request(id);
    if (!entry) return;
  } else {
    counters.cached++;
  }

  // ---- title: edit the existing text node so YouTube's own renderer keeps working
  const titleEl = tile.querySelector(
    'ytlr-tile-metadata-renderer yt-formatted-string'
  );
  if (titleEl && titleEl.firstChild && titleEl.firstChild.nodeType === 3) {
    const node = titleEl.firstChild;
    if (configRead('deArrowTitles') && entry.t) {
      if (node.nodeValue !== entry.t) {
        if (st.origTitle == null || node.nodeValue !== st.appliedTitle) {
          st.origTitle = node.nodeValue;
        }
        node.nodeValue = entry.t;
        st.appliedTitle = entry.t;
        counters.titles++;
      }
    } else if (st.appliedTitle != null && node.nodeValue === st.appliedTitle) {
      node.nodeValue = st.origTitle;
      st.appliedTitle = null;
    }
  }

  // ---- thumbnail
  const bg = thumbEl.style.backgroundImage;
  if (configRead('deArrowThumbnails') && entry.ts != null) {
    const target = `${THUMB_API}${id}&time=${entry.ts}`;
    if (bg.indexOf(target) < 0 && !st.loading) {
      if (!bg.includes('videoID=')) st.origBg = bg;
      st.loading = true;
      const img = new Image();
      img.onload = () => {
        st.loading = false;
        // only swap if the tile still shows the same video
        if (tile.__king === st && videoIdOf(thumbEl) === id) {
          thumbEl.style.backgroundImage = `url("${target}")`;
          counters.thumbs++;
        }
      };
      img.onerror = () => {
        st.loading = false;
      };
      img.src = target;
    }
  } else if (st.origBg && bg.includes('videoID=')) {
    thumbEl.style.backgroundImage = st.origBg;
    st.origBg = null;
  }
}

function scan() {
  scanTimer = null;
  if (!configRead('enableDeArrow')) return;
  const tiles = document.querySelectorAll('ytlr-tile-renderer');
  for (let i = 0; i < tiles.length && i < 60; i++) {
    try {
      processTile(tiles[i]);
    } catch (e) {
      console.warn('[dearrow] tile failed', e);
    }
  }
}

function scheduleScan() {
  if (scanTimer) return;
  scanTimer = setTimeout(scan, 300);
}

function restoreAll() {
  document.querySelectorAll('ytlr-tile-renderer').forEach((tile) => {
    const st = tile.__king;
    if (!st) return;
    const titleEl = tile.querySelector(
      'ytlr-tile-metadata-renderer yt-formatted-string'
    );
    if (
      titleEl &&
      titleEl.firstChild &&
      st.appliedTitle != null &&
      titleEl.firstChild.nodeValue === st.appliedTitle
    ) {
      titleEl.firstChild.nodeValue = st.origTitle;
      st.appliedTitle = null;
    }
    const thumbEl = tile.querySelector('ytlr-thumbnail-details');
    if (
      thumbEl &&
      st.origBg &&
      thumbEl.style.backgroundImage.includes('videoID=')
    ) {
      thumbEl.style.backgroundImage = st.origBg;
      st.origBg = null;
    }
  });
}

function start() {
  if (observer) return;
  observer = new MutationObserver(scheduleScan);
  observer.observe(document.body, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['style']
  });
  scheduleScan();
}

function stop() {
  if (observer) observer.disconnect();
  observer = null;
  restoreAll();
}

if (configRead('enableDeArrow')) start();

configAddChangeListener('enableDeArrow', (evt) =>
  evt.detail.newValue ? start() : stop()
);
['deArrowTitles', 'deArrowThumbnails'].forEach((k) => {
  configAddChangeListener(k, () => {
    if (configRead('enableDeArrow')) {
      restoreAll();
      scheduleScan();
    }
  });
});
