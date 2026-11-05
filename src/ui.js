/*global navigate, __YTAF_VERSION__*/
import './spatial-navigation-polyfill.js';
import {
  configAddChangeListener,
  configRead,
  configWrite,
  configGetLabel
} from './config.js';
import './ui.css';
import { requireElement } from './player_api/helpers';
import { formatSbStats } from './sb-stats';
import { getNowPlaying } from './now-playing';

// We handle key events ourselves.
window.__spatialNavigation__.keyMode = 'NONE';

const ARROW_KEY_CODE = { 37: 'left', 38: 'up', 39: 'right', 40: 'down' };

const colorCodeMap = new Map([
  [403, 'red'],

  [404, 'green'],
  [172, 'green'],

  [405, 'yellow'],
  [170, 'yellow'],

  [406, 'blue'],
  [167, 'blue'],
  [191, 'blue']
]);

/**
 * Returns the name of the color button associated with a code or null if not a color button.
 * @param {number} charCode KeyboardEvent.charCode property from event
 * @returns {string | null} Color name or null
 */
function getKeyColor(charCode) {
  if (colorCodeMap.has(charCode)) {
    return colorCodeMap.get(charCode);
  }

  return null;
}

const BRAND = 'Albrhi The KING';

const isArabic = () => configRead('uiArabic') !== false;
const tr = (ar, en) => (isArabic() ? ar : en);

const SECTIONS = [
  { id: 'general', ar: 'عام', en: 'General', icon: '◈' },
  { id: 'video', ar: 'الفيديو', en: 'Video', icon: '▶' },
  {
    id: 'sponsor',
    ar: 'SponsorBlock — تخطّي المقاطع',
    en: 'SponsorBlock — skip segments',
    icon: '⏭'
  },
  {
    id: 'dearrow',
    ar: 'DeArrow — عناوين وصور صادقة',
    en: 'DeArrow — honest titles & thumbnails',
    icon: '✎'
  },
  { id: 'interface', ar: 'الواجهة', en: 'Interface', icon: '✦' }
];

const SECTION_KEYS = {
  general: [
    'enableAdBlock',
    'upgradeThumbnails',
    'hideLogo',
    'showWatch',
    'autoAccountSelect'
  ],
  video: [
    'forceHighResVideo',
    'removeEndscreen',
    'removeShorts',
    'enableStats'
  ],
  sponsor: [
    'enableSponsorBlock',
    'enableSponsorBlockManual',
    'enableSponsorBlockSponsor',
    'enableSponsorBlockIntro',
    'enableSponsorBlockOutro',
    'enableSponsorBlockInteraction',
    'enableSponsorBlockSelfPromo',
    'enableSponsorBlockMusicOfftopic',
    'enableSponsorBlockPreview'
  ],
  dearrow: ['enableDeArrow', 'deArrowTitles', 'deArrowThumbnails'],
  interface: ['uiArabic']
};

// Built with DOM calls, not innerHTML: YouTube enforces a TrustedHTML policy.
function createCrownSvg() {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 64 48');
  svg.setAttribute('aria-hidden', 'true');
  const add = (tag, attrs) => {
    const el = document.createElementNS(NS, tag);
    Object.keys(attrs).forEach((k) => {
      el.setAttribute(k, attrs[k]);
    });
    el.setAttribute('fill', 'currentColor');
    svg.appendChild(el);
  };
  add('path', { d: 'M4 40 L8 12 L22 26 L32 6 L42 26 L56 12 L60 40 Z' });
  add('rect', { x: 4, y: 42, width: 56, height: 5, rx: 2.5 });
  add('circle', { cx: 8, cy: 10, r: 3.5 });
  add('circle', { cx: 32, cy: 4, r: 3.5 });
  add('circle', { cx: 56, cy: 10, r: 3.5 });
  return svg;
}

/** Live inputs per key; a single change listener per key updates them. */
const switchInputs = {};
const listenedKeys = new Set();

function createSwitchRow(key, isSub) {
  const elmInput = document.createElement('input');
  elmInput.type = 'checkbox';
  elmInput.className = 'ytaf-switch';
  elmInput.checked = configRead(key);
  switchInputs[key] = elmInput;

  elmInput.addEventListener('change', (evt) => {
    configWrite(key, evt.target.checked);
  });

  if (!listenedKeys.has(key)) {
    listenedKeys.add(key);
    configAddChangeListener(key, (evt) => {
      if (switchInputs[key]) switchInputs[key].checked = evt.detail.newValue;
    });
  }

  const elmText = document.createElement('span');
  elmText.className = 'ytaf-row-text';
  elmText.textContent = configGetLabel(key, isArabic());

  const elmLabel = document.createElement('label');
  elmLabel.className = 'ytaf-row' + (isSub ? ' ytaf-row-sub' : '');
  elmLabel.appendChild(elmText);
  elmLabel.appendChild(elmInput);

  return elmLabel;
}

function createSection(section) {
  const elmSection = document.createElement('section');
  elmSection.className = 'ytaf-section ytaf-section-' + section.id;

  const elmTitle = document.createElement('h2');
  elmTitle.className = 'ytaf-section-title';
  const elmIcon = document.createElement('span');
  elmIcon.className = 'ytaf-section-icon';
  elmIcon.textContent = section.icon;
  elmTitle.appendChild(elmIcon);
  elmTitle.appendChild(
    document.createTextNode(isArabic() ? section.ar : section.en)
  );
  elmSection.appendChild(elmTitle);

  SECTION_KEYS[section.id].forEach((key, i) => {
    const isSub =
      (section.id === 'sponsor' || section.id === 'dearrow') && i > 0;
    elmSection.appendChild(createSwitchRow(key, isSub));
  });

  if (section.id === 'sponsor') {
    const elmStat = document.createElement('div');
    elmStat.className = 'ytaf-stat';
    elmStat.textContent = formatSbStats(isArabic());
    elmSection.appendChild(elmStat);
  }

  return elmSection;
}

function createHint(color, text) {
  const elm = document.createElement('span');
  elm.className = 'ytaf-hint';
  const dot = document.createElement('i');
  dot.className = 'ytaf-hint-dot ytaf-hint-' + color;
  if (color === 'arrows') dot.textContent = '▲▼◀▶';
  else if (color === 'ok') dot.textContent = 'OK';
  else if (color === 'back') dot.textContent = '⮌';
  elm.appendChild(dot);
  elm.appendChild(document.createTextNode(text));
  return elm;
}

const DIM_MASTER = { sponsor: 'enableSponsorBlock', dearrow: 'enableDeArrow' };

function updateDim(root) {
  const scope = root instanceof Element ? root : document;
  Object.keys(DIM_MASTER).forEach((id) => {
    const sec = scope.querySelector('.ytaf-section-' + id);
    if (sec) {
      sec.classList.toggle('ytaf-section-off', !configRead(DIM_MASTER[id]));
    }
  });
}

function renderPanel(container) {
  const arabic = isArabic();
  container.setAttribute('dir', arabic ? 'rtl' : 'ltr');
  container.textContent = '';

  const elmCard = document.createElement('div');
  elmCard.className = 'ytaf-ui-card';

  const elmHeader = document.createElement('header');
  elmHeader.className = 'ytaf-ui-header';

  const elmCrown = document.createElement('div');
  elmCrown.className = 'ytaf-ui-crown';
  elmCrown.appendChild(createCrownSvg());
  elmHeader.appendChild(elmCrown);

  const elmTitles = document.createElement('div');
  elmTitles.className = 'ytaf-ui-titles';
  const elmHeading = document.createElement('h1');
  elmHeading.textContent = BRAND;
  const elmSub = document.createElement('p');
  elmSub.textContent = tr(
    'يوتيوب للتلفزيون · الإعدادات',
    'YouTube for TV · Settings'
  );
  elmTitles.appendChild(elmHeading);
  elmTitles.appendChild(elmSub);
  elmHeader.appendChild(elmTitles);
  elmCard.appendChild(elmHeader);

  const elmBody = document.createElement('div');
  elmBody.className = 'ytaf-ui-body';

  const elmColA = document.createElement('div');
  elmColA.className = 'ytaf-ui-col';
  const elmColB = document.createElement('div');
  elmColB.className = 'ytaf-ui-col';
  const byId = Object.fromEntries(SECTIONS.map((x) => [x.id, x]));
  const innerA = document.createElement('div');
  innerA.className = 'ytaf-col-inner';
  const innerB = document.createElement('div');
  innerB.className = 'ytaf-col-inner';
  innerA.appendChild(createSection(byId.general));
  innerA.appendChild(createSection(byId.video));
  innerA.appendChild(createSection(byId.interface));
  innerB.appendChild(createSection(byId.sponsor));
  innerB.appendChild(createSection(byId.dearrow));
  elmColA.appendChild(innerA);
  elmColB.appendChild(innerB);
  elmBody.appendChild(elmColA);
  elmBody.appendChild(elmColB);
  elmCard.appendChild(elmBody);

  const elmHints = document.createElement('footer');
  elmHints.className = 'ytaf-ui-hints';
  elmHints.appendChild(createHint('arrows', tr('تنقّل', 'Move')));
  elmHints.appendChild(createHint('ok', tr('تبديل', 'Toggle')));
  elmHints.appendChild(createHint('green', tr('إغلاق', 'Close')));
  elmHints.appendChild(createHint('blue', tr('وضع الصوت فقط', 'Audio only')));
  elmHints.appendChild(createHint('back', tr('رجوع', 'Back')));
  elmCard.appendChild(elmHints);

  const elmVersion = document.createElement('div');
  elmVersion.className = 'ytaf-ui-version';
  elmVersion.setAttribute('dir', 'ltr');
  elmVersion.textContent = `${BRAND} v${__YTAF_VERSION__} · based on webOS YouTube Extended (GPL-3.0) · sponsor.ajay.app`;
  elmCard.appendChild(elmVersion);

  container.appendChild(elmCard);
  updateDim(container);
}

/**
 * Keeps the focused row visible inside its column. The TV's browser ignores
 * scrollTop on the column, so the column content is moved with a transform.
 */
function revealRow(target) {
  const row = target && target.closest && target.closest('.ytaf-row');
  const inner = row && row.closest('.ytaf-col-inner');
  const col = inner && inner.parentElement;
  if (!col) return;
  col.scrollTop = 0; // undo any native focus-scroll
  const prev = row.previousElementSibling;
  const topEl =
    prev && prev.classList.contains('ytaf-section-title') ? prev : row;
  const pad = 18;
  let off = inner.__off || 0;
  const rowBottom = row.offsetTop + row.offsetHeight;
  if (rowBottom + pad > off + col.clientHeight) {
    off = rowBottom + pad - col.clientHeight;
  } else if (topEl.offsetTop - pad < off) {
    off = topEl.offsetTop - pad;
  }
  off = Math.max(0, Math.min(off, inner.offsetHeight - col.clientHeight));
  inner.__off = off;
  inner.style.transform = `translateY(${-off}px)`;
}

function createOptionsPanel() {
  const elmContainer = document.createElement('div');

  elmContainer.classList.add('ytaf-ui-container');
  elmContainer.style['display'] = 'none';
  elmContainer.setAttribute('tabindex', 0);

  elmContainer.addEventListener(
    'focus',
    () => console.debug('Options panel focused!'),
    true
  );
  elmContainer.addEventListener(
    'blur',
    () => console.debug('Options panel blurred!'),
    true
  );

  elmContainer.addEventListener('focusin', (evt) => revealRow(evt.target));

  renderPanel(elmContainer);

  return elmContainer;
}

const optionsPanel = createOptionsPanel();
document.body.appendChild(optionsPanel);

Object.keys(DIM_MASTER).forEach((id) => {
  configAddChangeListener(DIM_MASTER[id], () => updateDim(optionsPanel));
});
configAddChangeListener('uiArabic', () => {
  // Rebuild the screen in the new language and keep the focus on the same row.
  renderPanel(optionsPanel);
  const again = switchInputs['uiArabic'];
  if (again) again.focus();
});

let optionsPanelVisible = false;

/**
 * Show or hide the options panel.
 * @param {boolean} [visible=true] Whether to show the options panel.
 */
function showOptionsPanel(visible) {
  visible ??= true;

  if (visible && !optionsPanelVisible) {
    console.debug('Showing and focusing options panel!');
    optionsPanel.style.display = 'flex';
    const stat = optionsPanel.querySelector('.ytaf-stat');
    if (stat) stat.textContent = formatSbStats(isArabic());
    const first = optionsPanel.querySelector('input');
    (first || optionsPanel).focus();
    optionsPanelVisible = true;
  } else if (!visible && optionsPanelVisible) {
    console.debug('Hiding options panel!');
    optionsPanel.style.display = 'none';
    optionsPanel.blur();
    optionsPanelVisible = false;
  }
}

window.ytaf_showOptionsPanel = showOptionsPanel;

/**
 * While the panel is open it owns the remote: keys are handled at window level
 * (capture, registered before YouTube's own listeners) so they never reach the
 * YouTube page behind, even if YouTube steals the focus from the panel.
 */
/** Own up/down/left/right focus movement (more predictable than the polyfill). */
function moveFocus(dir) {
  const cols = Array.from(optionsPanel.querySelectorAll('.ytaf-ui-col'));
  const rows = cols.map((c) =>
    Array.from(c.querySelectorAll('input.ytaf-switch'))
  );
  const cur = document.activeElement;
  const colIdx = cols.findIndex((c) => c.contains(cur));
  if (colIdx < 0) return;
  let target = null;
  if (dir === 'down' || dir === 'up') {
    const list = rows[colIdx];
    target = list[list.indexOf(cur) + (dir === 'down' ? 1 : -1)];
  } else {
    const rtl = optionsPanel.getAttribute('dir') === 'rtl';
    const step = (dir === 'right') === !rtl ? 1 : -1;
    const list = rows[colIdx + step];
    if (list && list.length) {
      const y = cur.getBoundingClientRect().top;
      target = list.reduce((best, x) =>
        Math.abs(x.getBoundingClientRect().top - y) <
        Math.abs(best.getBoundingClientRect().top - y)
          ? x
          : best
      );
    }
  }
  if (target) target.focus();
  revealRow(target || cur);
}

function panelKeyHandler(evt) {
  if (!optionsPanelVisible) return;

  // Green (close) and blue (audio-only) are handled by eventHandler below.
  const color = getKeyColor(evt.charCode) || getKeyColor(evt.keyCode);
  if (color === 'green' || color === 'blue') return;

  if (evt.type === 'keydown') {
    const insidePanel = optionsPanel.contains(document.activeElement);
    const code = evt.keyCode;

    if (code in ARROW_KEY_CODE) {
      if (insidePanel) {
        moveFocus(ARROW_KEY_CODE[code]);
      } else {
        // Focus was taken elsewhere: bring it back first.
        const first = optionsPanel.querySelector('input');
        if (first) first.focus();
      }
    } else if (code === 13) {
      /**
       * The YouTube app generates these "OK" events from clicks (including
       * with the Magic Remote), and we don't want to send a duplicate click
       * event for those. Youtube uses the `Event` class instead of
       * `KeyboardEvent` so we check for that.
       * See issue #143 and #200 for context.
       */
      if (evt instanceof KeyboardEvent && insidePanel) {
        document.activeElement.click();
      }
    } else if (code === 27 || code === 461 || code === 8) {
      // Back button (27 on keyboards, 461 on the LG remote)
      showOptionsPanel(false);
    }
  }

  evt.preventDefault();
  evt.stopImmediatePropagation();
}

window.addEventListener('keydown', panelKeyHandler, true);
window.addEventListener('keypress', panelKeyHandler, true);
window.addEventListener('keyup', panelKeyHandler, true);

/**
 * RED (video stats) and YELLOW (skip a sponsor segment) are caught at window
 * level, ahead of YouTube: its own handler swallows some colour keys before
 * they would reach the document-level handler below.
 */
function colorKeyHandler(evt) {
  const color = getKeyColor(evt.charCode) || getKeyColor(evt.keyCode);
  const takeRed = color === 'red' && configRead('enableStats');
  // YELLOW only while a "skip?" banner is showing; otherwise YouTube keeps it.
  const takeYellow = color === 'yellow' && window.__kingSkipPrompt;
  if (!takeRed && !takeYellow) return;

  if (evt.type === 'keydown') {
    window.dispatchEvent(new Event(takeRed ? 'king-red' : 'king-yellow'));
  }
  evt.preventDefault();
  evt.stopImmediatePropagation();
}

window.addEventListener('keydown', colorKeyHandler, true);
window.addEventListener('keypress', colorKeyHandler, true);
window.addEventListener('keyup', colorKeyHandler, true);

const lastColorAt = {};

const eventHandler = (evt) => {
  console.debug(
    'Key event:',
    evt.type,
    evt.charCode,
    evt.keyCode,
    evt.defaultPrevented
  );

  // Every remote press arrives twice: the real KeyboardEvent (keyCode 404,
  // charCode 0) and a copy YouTube re-dispatches as a plain Event (keyCode and
  // charCode 172). Like upstream we act on the copy only (charCode), and ignore
  // a repeat of the same colour within 120 ms just in case.
  const color = getKeyColor(evt.charCode);
  if (color && evt.type === 'keydown') {
    const now = Date.now();
    if (now - (lastColorAt[color] || 0) < 120) {
      evt.preventDefault();
      evt.stopPropagation();
      return false;
    }
    lastColorAt[color] = now;
  }

  if (color === 'green') {
    console.debug('Taking over!');

    evt.preventDefault();
    evt.stopPropagation();

    if (evt.type === 'keydown') {
      // Toggle visibility.
      showOptionsPanel(!optionsPanelVisible);
    }
    return false;
  } else if (color === 'blue') {
    evt.preventDefault();
    evt.stopPropagation();

    if (evt.type === 'keydown') {
      // Toggle Audio-Only mode.
      initAudioOnlyToggle();
    }
    return false;
  }
  return true;
};

document.addEventListener('keydown', eventHandler, true);
document.addEventListener('keypress', eventHandler, true);
document.addEventListener('keyup', eventHandler, true);

const COLOR_MAP = {
  red: 'rgba(255, 0, 0, 0.9)',
  green: 'rgba(0, 162, 0, 0.9)',
  yellow: 'rgba(255, 255, 0, 0.9)',
  blue: 'rgba(0, 128, 255, 0.9)',
  grey: 'rgba(255, 255, 255, 0.5)',
  gold: 'rgba(245, 185, 66, 0.95)',
  none: 'rgba(0, 0, 0, 0)'
};

export function showNotification(text, time = 3000, color = 'grey') {
  if (!document.querySelector('.ytaf-notification-container')) {
    console.debug('Adding notification container');
    const c = document.createElement('div');
    c.classList.add('ytaf-notification-container');
    document.body.appendChild(c);
  }

  const elm = document.createElement('div');
  const elmInner = document.createElement('div');
  elmInner.innerText = text;
  elmInner.classList.add('message');
  elmInner.classList.add('message-hidden');
  elm.appendChild(elmInner);
  document.querySelector('.ytaf-notification-container').appendChild(elm);
  elmInner.style.borderColor = COLOR_MAP[color] || color;

  setTimeout(() => {
    elmInner.classList.remove('message-hidden');
  }, 100);
  setTimeout(() => {
    elmInner.classList.add('message-hidden');
    setTimeout(() => {
      elm.remove();
    }, 1000);
  }, time);
}

/**
 * Initialize ability to hide YouTube logo in top right corner.
 */
function initHideLogo() {
  const style = document.createElement('style');
  document.head.appendChild(style);

  /** @type {(hide: boolean) => void} */
  const setHidden = (hide) => {
    const visibility = hide ? 'hidden' : 'visible';
    style.textContent = `ytlr-redux-connect-ytlr-logo-entity { visibility: ${visibility}; }`;
  };

  setHidden(configRead('hideLogo'));

  configAddChangeListener('hideLogo', (evt) => {
    setHidden(evt.detail.newValue);
  });
}

function applyUIFixes() {
  try {
    const bodyClasses = document.body.classList;

    const observer = new MutationObserver(function bodyClassCallback(
      _records,
      _observer
    ) {
      try {
        if (bodyClasses.contains('app-quality-root')) {
          bodyClasses.remove('app-quality-root');
        }
      } catch (e) {
        console.error('error in <body> class observer callback:', e);
      }
    });

    observer.observe(document.body, {
      subtree: false,
      childList: false,
      attributes: true,
      attributeFilter: ['class'],
      characterData: false
    });
  } catch (e) {
    console.error('error setting up <body> class observer:', e);
  }
}

let audioOnlyEnabled = false;
let audioScreen = null;
let audioTick = null;
let audioMoveTick = null;
let audioPeekTimer = null;

function fmtTime(sec) {
  if (!Number.isFinite(sec) || sec < 0) return '--:--';
  const s = Math.floor(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = ('0' + (s % 60)).slice(-2);
  return h ? `${h}:${('0' + m).slice(-2)}:${ss}` : `${m}:${ss}`;
}

function onWatchPage() {
  try {
    return (
      new URL(location.hash.substring(1), location.href).pathname === '/watch'
    );
  } catch {
    return false;
  }
}

function buildAudioScreen() {
  const mk = (cls, parent, text) => {
    const el = document.createElement('div');
    el.className = cls;
    if (text) el.textContent = text;
    if (parent) parent.appendChild(el);
    return el;
  };
  const root = mk('king-audio');
  const card = mk('king-audio-card', root);
  const thumb = document.createElement('img');
  thumb.className = 'king-audio-thumb';
  thumb.alt = '';
  thumb.onerror = () => {
    thumb.style.visibility = 'hidden';
  };
  card.appendChild(thumb);
  const note = mk('king-audio-note', card);
  const title = mk('king-audio-title', card);
  const author = mk('king-audio-author', card);
  const bar = mk('king-audio-bar', card);
  const fill = mk('king-audio-fill', bar);
  const time = mk('king-audio-time', card);
  const clock = mk('king-audio-clock', root);
  return { root, card, thumb, note, title, author, fill, time, clock };
}

function setText(el, text) {
  if (el.textContent !== text) el.textContent = text;
}

function updateAudioScreen() {
  if (!audioScreen) return;
  const watching = onWatchPage();
  audioScreen.root.style.display = watching ? 'flex' : 'none';

  const video = document.querySelector('video');
  if (video) {
    // YouTube re-creates the video element between videos: keep it hidden.
    const want = watching ? 'hidden' : '';
    if (video.style.visibility !== want) video.style.visibility = want;
  }
  if (!watching) return;

  const { id, title, author } = getNowPlaying();
  if (id && audioScreen.thumbId !== id) {
    audioScreen.thumbId = id;
    audioScreen.thumb.style.visibility = 'visible';
    audioScreen.thumb.src = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
  }
  const arabic = isArabic();
  audioScreen.root.setAttribute('dir', arabic ? 'rtl' : 'ltr');
  setText(audioScreen.title, title);
  setText(audioScreen.author, author);
  setText(
    audioScreen.note,
    (video && video.paused ? '⏸ ' : '♪ ') +
      tr('وضع الصوت فقط', 'Audio-only mode')
  );
  if (video) {
    setText(
      audioScreen.time,
      `${fmtTime(video.currentTime)} / ${fmtTime(video.duration)}`
    );
    const pct = video.duration ? (video.currentTime / video.duration) * 100 : 0;
    audioScreen.fill.style.width = Math.min(100, Math.max(0, pct)) + '%';
  }
  setText(
    audioScreen.clock,
    new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  );
}

// Slowly drift the card around so nothing stays lit on the same pixels.
function driftAudioCard() {
  if (!audioScreen) return;
  const dx = Math.round((Math.random() - 0.5) * 16);
  const dy = Math.round((Math.random() - 0.5) * 16);
  audioScreen.card.style.transform = `translate(${dx}vw, ${dy}vh)`;
}

// Any remote key briefly reveals YouTube's own controls under the black screen.
function peekAudioControls() {
  if (!audioScreen) return;
  audioScreen.root.classList.add('king-audio-peek');
  clearTimeout(audioPeekTimer);
  audioPeekTimer = setTimeout(() => {
    if (audioScreen) audioScreen.root.classList.remove('king-audio-peek');
  }, 4000);
}

function startAudioScreen() {
  if (audioScreen) return;
  audioScreen = buildAudioScreen();
  document.body.appendChild(audioScreen.root);
  updateAudioScreen();
  audioTick = setInterval(updateAudioScreen, 500);
  audioMoveTick = setInterval(driftAudioCard, 45000);
  window.addEventListener('keydown', peekAudioControls, true);
}

function stopAudioScreen() {
  clearInterval(audioTick);
  clearInterval(audioMoveTick);
  clearTimeout(audioPeekTimer);
  window.removeEventListener('keydown', peekAudioControls, true);
  if (audioScreen) audioScreen.root.remove();
  audioScreen = null;
}

async function initAudioOnlyToggle() {
  const elVideo = await requireElement('video', HTMLVideoElement);

  audioOnlyEnabled = !audioOnlyEnabled;
  elVideo.style.visibility = audioOnlyEnabled ? 'hidden' : '';

  showNotification(
    audioOnlyEnabled
      ? tr('وضع الصوت فقط: مفعّل', 'Audio-Only mode: Enabled')
      : tr('وضع الصوت فقط: متوقف', 'Audio-Only mode: Disabled'),
    2000,
    'blue'
  );

  if (audioOnlyEnabled) startAudioScreen();
  else stopAudioScreen();
}

applyUIFixes();
initHideLogo();

setTimeout(() => {
  showNotification(
    tr(
      `${BRAND} — اضغط الأخضر لفتح الإعدادات`,
      `${BRAND} — press GREEN for settings`
    ),
    3000,
    'gold'
  );
});
