// Remembers title/author of videos from YouTube's own player responses, because
// the TV player's getVideoData() often returns them empty.
const meta = {};
window.__kingMeta = meta;

const origParse = JSON.parse;
JSON.parse = function () {
  const r = origParse.apply(this, arguments);
  try {
    let vd = null;
    if (r && typeof r === 'object') {
      vd = r.videoDetails || null;
      // player data is sometimes wrapped one level down (e.g. playerResponse)
      for (const k in r) {
        if (vd) break;
        const v = r[k];
        if (v && typeof v === 'object' && !Array.isArray(v) && v.videoDetails) {
          vd = v.videoDetails;
        }
      }
    }
    if (vd && vd.videoId && (vd.title || vd.author)) {
      meta[vd.videoId] = { title: vd.title || '', author: vd.author || '' };
    }
  } catch {
    // never break YouTube's own parsing
  }
  return r;
};

function currentVideoId() {
  try {
    const q = new URL(location.hash.substring(1), location.href).searchParams;
    if (q.get('v')) return q.get('v');
  } catch {
    // fall through to the player
  }
  try {
    return document.querySelector('.html5-video-player').getVideoData()
      .video_id;
  } catch {
    return '';
  }
}

function domText(selector) {
  const nodes = document.querySelectorAll(selector);
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i].closest('ytlr-tile-renderer')) continue;
    const t = (nodes[i].textContent || '')
      .replace(/[\u200e\u200f]/g, '')
      .trim();
    if (t) return t;
  }
  return '';
}

/** { id, title, author } of the video on screen (title/author may be ''). */
export function getNowPlaying() {
  const id = currentVideoId() || '';
  let title = (meta[id] && meta[id].title) || '';
  let author = (meta[id] && meta[id].author) || '';
  if (!title || !author) {
    try {
      const d = document.querySelector('.html5-video-player').getVideoData();
      if (d && (!id || d.video_id === id)) {
        title = title || d.title || '';
        author = author || d.author || '';
      }
    } catch {
      // player not ready
    }
  }
  // The watch screen's own title tray always has them (checked on the real TV).
  if (!title) title = domText('ytlr-video-title-tray [idomkey="title-text"]');
  if (!author)
    author = domText('ytlr-video-title-tray [idomkey="detail-text-0"]');
  return { id, title, author };
}
