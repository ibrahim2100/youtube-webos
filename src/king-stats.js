// Video stats overlay, toggled with the RED remote button (see ui.js).
import { configRead } from './config';

let box = null;
let timer = null;
let last = null; // { t, frames } for the fps estimate

const isArabic = () => configRead('uiArabic') !== false;
const tr = (ar, en) => (isArabic() ? ar : en);

function getPlayer() {
  return document.querySelector('.html5-video-player');
}

function fmt(n, d) {
  return Number.isFinite(n) ? n.toFixed(d) : '-';
}

function buildLines() {
  const video = document.querySelector('video');
  if (!video || !video.videoWidth) {
    return [tr('لا يوجد فيديو يعمل الآن', 'No video playing right now')];
  }

  const player = getPlayer();
  let label = '';
  let id = '';
  try {
    label = player.getPlaybackQualityLabel() || '';
    id = (player.getVideoData() || {}).video_id || '';
  } catch {
    // player API not ready
  }

  const q = video.getVideoPlaybackQuality
    ? video.getVideoPlaybackQuality()
    : null;
  let fps = '-';
  const now = Date.now();
  if (q) {
    if (last && !video.paused && now > last.t) {
      const f = ((q.totalVideoFrames - last.frames) * 1000) / (now - last.t);
      if (f >= 0 && f < 241) fps = fmt(f, 0);
    }
    last = { t: now, frames: q.totalVideoFrames };
  }

  let buffered = 0;
  for (let i = 0; i < video.buffered.length; i++) {
    if (
      video.currentTime >= video.buffered.start(i) &&
      video.currentTime <= video.buffered.end(i)
    ) {
      buffered = video.buffered.end(i) - video.currentTime;
    }
  }

  const lines = [
    `${tr('الدقة', 'Resolution')}: ${video.videoWidth}×${video.videoHeight}${
      label ? ' · ' + label : ''
    }`,
    `${tr('الإطارات', 'Frames')}: ${fps} fps${
      q
        ? ` · ${tr('مفقودة', 'dropped')} ${q.droppedVideoFrames}/${q.totalVideoFrames}`
        : ''
    }`,
    `${tr('المخزَّن مسبقًا', 'Buffered')}: ${fmt(buffered, 0)} ${tr('ث', 's')}`,
    `${tr('السرعة', 'Speed')}: ${video.playbackRate}×`
  ];
  const conn = navigator.connection;
  if (conn && conn.downlink) {
    lines.push(`${tr('الشبكة', 'Network')}: ~${conn.downlink} Mbps`);
  }
  if (id) lines.push(`ID: ${id}`);
  return lines;
}

function render() {
  if (!box) return;
  const lines = buildLines();
  box.textContent = '';
  const title = document.createElement('div');
  title.className = 'king-stats-title';
  title.textContent = tr('إحصائيات الفيديو', 'Video stats');
  box.appendChild(title);
  lines.forEach((l) => {
    const row = document.createElement('div');
    row.textContent = l;
    box.appendChild(row);
  });
}

export function toggleStats() {
  if (box) {
    clearInterval(timer);
    timer = null;
    box.remove();
    box = null;
    last = null;
    return;
  }
  box = document.createElement('div');
  box.className = 'king-stats';
  box.setAttribute('dir', isArabic() ? 'rtl' : 'ltr');
  document.body.appendChild(box);
  render();
  timer = setInterval(render, 1000);
}

window.addEventListener('king-red', () => {
  if (configRead('enableStats')) toggleStats();
});
