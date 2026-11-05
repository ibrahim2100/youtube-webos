import '../src/ui.js';
import '../src/watch.css';
import { sanitize, isShortsTile } from '../src/shorts.js';
import { pickBranding } from '../src/dearrow.js';
import '../src/king-stats.js';
import { SponsorBlockHandler } from '../src/sponsorblock.js';
import { readSbStats, resetSbStats } from '../src/sb-stats.js';

// ---- test hooks ----
window.__t = {
  sanitize,
  isShortsTile,
  pickBranding,
  SponsorBlockHandler,
  readSbStats,
  resetSbStats
};

const w = document.createElement('div');
w.className = 'webOs-watch';
w.textContent = '9:41 PM';
document.body.appendChild(w);

// Stand-in for YouTube's own key handling (registered after ours, like on the TV).
window.__ytKeys = 0;
window.addEventListener(
  'keydown',
  () => {
    window.__ytKeys++;
  },
  true
);
document.addEventListener(
  'keydown',
  () => {
    window.__ytKeys++;
  },
  false
);

// ---- fake YouTube page pieces (built with DOM calls: the CSP forbids innerHTML) ----
const el = (tag, parent, attrs) => {
  const e = document.createElement(tag);
  Object.keys(attrs || {}).forEach((k) => e.setAttribute(k, attrs[k]));
  if (parent) parent.appendChild(e);
  return e;
};

// player + video (the real one reports title/author/quality through these)
const player = el('div', document.body, { class: 'html5-video-player' });
player.getVideoData = () => ({
  video_id: 'dQw4w9WgXcQ',
  title: 'اختبار عنوان الأغنية الطويل جداً — Test Song Title',
  author: 'Test Channel'
});
player.getPlaybackQualityLabel = () => '1080p60';
const video = el('video', player);
Object.defineProperty(video, 'videoWidth', { value: 1920 });
Object.defineProperty(video, 'videoHeight', { value: 1080 });
Object.defineProperty(video, 'currentTime', { value: 83.2, writable: true });
Object.defineProperty(video, 'duration', { value: 215 });
Object.defineProperty(video, 'paused', { value: false });
let frames = 0;
video.getVideoPlaybackQuality = () => ({
  totalVideoFrames: (frames += 60),
  droppedVideoFrames: 2
});
Object.defineProperty(video, 'buffered', {
  value: { length: 1, start: () => 0, end: () => 140 }
});

// a home-page tile with YouTube's real structure
window.__addTile = (id, title) => {
  const tile = el('ytlr-tile-renderer', document.body);
  const prev = el('ytlr-playback-preview', tile);
  const hdr = el('ytlr-tile-header-renderer', prev);
  const d1 = el('div', hdr);
  const d2 = el('div', d1);
  const d3 = el('div', d2);
  const th = el('ytlr-thumbnail-details', d3);
  th.style.backgroundImage = `url("https://i.ytimg.com/vi/${id}/sddefault.webp")`;
  const meta = el('ytlr-tile-metadata-renderer', tile);
  const box = el('div', meta);
  const yfs = el('yt-formatted-string', box);
  yfs.appendChild(document.createTextNode(title));
  return tile;
};

// Simulates one real remote press: trusted-like KeyboardEvent (charCode 0) + YouTube's re-dispatched Event copy.
window.__press = (keyCode, altCode) => {
  document.body.dispatchEvent(
    new KeyboardEvent('keydown', {
      keyCode,
      charCode: 0,
      bubbles: true,
      cancelable: true
    })
  );
  const copy = new Event('keydown', { bubbles: true, cancelable: true });
  copy.keyCode = altCode;
  copy.charCode = altCode;
  document.body.dispatchEvent(copy);
};
