import sha256 from 'tiny-sha256';
import { configRead } from './config';
import { showNotification } from './ui';
import { addSkipped } from './sb-stats';

// Copied from https://github.com/ajayyy/SponsorBlock/blob/9392d16617d2d48abb6125c00e2ff6042cb7bebe/src/config.ts#L179-L233
const barTypes = {
  sponsor: {
    color: '#00d400',
    opacity: '0.7',
    name: 'sponsored segment',
    ar: 'مقطع ترويجي'
  },
  intro: {
    color: '#00ffff',
    opacity: '0.7',
    name: 'intro',
    ar: 'المقدمة'
  },
  outro: {
    color: '#0202ed',
    opacity: '0.7',
    name: 'outro',
    ar: 'الخاتمة'
  },
  interaction: {
    color: '#cc00ff',
    opacity: '0.7',
    name: 'interaction reminder',
    ar: 'تذكير بالتفاعل'
  },
  selfpromo: {
    color: '#ffff00',
    opacity: '0.7',
    name: 'self-promotion',
    ar: 'ترويج ذاتي'
  },
  music_offtopic: {
    color: '#ff9900',
    opacity: '0.7',
    name: 'non-music part',
    ar: 'جزء غير موسيقي'
  },
  preview: {
    color: '#008fd6',
    opacity: '0.7',
    name: 'recap or preview',
    ar: 'ملخص أو معاينة'
  }
};

const sponsorblockAPI = 'https://sponsorblock.inf.re/api';

export class SponsorBlockHandler {
  video = null;
  active = true;

  attachVideoTimeout = null;
  nextSkipTimeout = null;

  slider = null;
  sliderInterval = null;
  sliderObserver = null;
  sliderSegmentsOverlay = null;

  scheduleSkipHandler = null;
  durationChangeHandler = null;
  segments = null;
  skippableCategories = [];

  constructor(videoID) {
    this.videoID = videoID;
  }

  async init() {
    const videoHash = sha256(this.videoID).substring(0, 4);
    const categories = [
      'sponsor',
      'intro',
      'outro',
      'interaction',
      'selfpromo',
      'music_offtopic',
      'preview'
    ];
    const resp = await fetch(
      `${sponsorblockAPI}/skipSegments/${videoHash}?categories=${encodeURIComponent(
        JSON.stringify(categories)
      )}`
    );
    const results = await resp.json();

    const result = results.find((v) => v.videoID === this.videoID);
    console.debug(this.videoID, 'Got it:', result);

    if (!result || !result.segments || !result.segments.length) {
      console.debug(this.videoID, 'No segments found.');
      return;
    }

    this.segments = result.segments;
    this.skippableCategories = this.getSkippableCategories();

    this.scheduleSkipHandler = () => this.scheduleSkip();
    this.durationChangeHandler = () => this.buildOverlay();

    this.attachVideo();
    this.buildOverlay();
  }

  getSkippableCategories() {
    const skippableCategories = [];
    if (configRead('enableSponsorBlockSponsor')) {
      skippableCategories.push('sponsor');
    }
    if (configRead('enableSponsorBlockIntro')) {
      skippableCategories.push('intro');
    }
    if (configRead('enableSponsorBlockOutro')) {
      skippableCategories.push('outro');
    }
    if (configRead('enableSponsorBlockInteraction')) {
      skippableCategories.push('interaction');
    }
    if (configRead('enableSponsorBlockSelfPromo')) {
      skippableCategories.push('selfpromo');
    }
    if (configRead('enableSponsorBlockMusicOfftopic')) {
      skippableCategories.push('music_offtopic');
    }
    if (configRead('enableSponsorBlockPreview')) {
      skippableCategories.push('preview');
    }
    return skippableCategories;
  }

  attachVideo() {
    clearTimeout(this.attachVideoTimeout);
    this.attachVideoTimeout = null;

    this.video = document.querySelector('video');
    if (!this.video) {
      console.debug(this.videoID, 'No video yet...');
      this.attachVideoTimeout = setTimeout(() => this.attachVideo(), 100);
      return;
    }

    console.debug(this.videoID, 'Video found, binding...');

    this.video.addEventListener('play', this.scheduleSkipHandler);
    this.video.addEventListener('pause', this.scheduleSkipHandler);
    this.video.addEventListener('timeupdate', this.scheduleSkipHandler);
    this.video.addEventListener('durationchange', this.durationChangeHandler);
  }

  buildOverlay() {
    if (this.sliderSegmentsOverlay) {
      console.debug('Overlay already built');
      return;
    }

    if (!this.video || !this.video.duration) {
      console.debug('No video duration yet');
      return;
    }

    const videoDuration = this.video.duration;

    this.sliderSegmentsOverlay = document.createElement('div');
    this.sliderSegmentsOverlay.className =
      'ytaf-sponsorblock-segment-container';

    this.segments.forEach((segment) => {
      const [start, end] = segment.segment;
      const barType = barTypes[segment.category] || {
        color: 'blue'
      };
      const elm = document.createElement('div');
      elm.className = 'ytaf-sponsorblock-segment';
      elm.style['background-color'] = barType.color;
      elm.style['left'] = `${(start / videoDuration) * 100.0}%`;
      elm.style['width'] = `${((end - start) / videoDuration) * 100.0}%`;
      this.sliderSegmentsOverlay.appendChild(elm);
    });

    const addSliderObserver = (ele) => {
      this.sliderObserver.observe(ele, {
        childList: true,
        subtree: true
      });
    };

    const addSliderOverlay = () => {
      this.slider.appendChild(this.sliderSegmentsOverlay);
    };

    const watchForSlider = () => {
      if (this.sliderInterval) clearInterval(this.sliderInterval);

      this.sliderInterval = setInterval(() => {
        const nodes = document.querySelectorAll('[idomkey=progress-bar]');
        const last = nodes[nodes.length - 1];
        switch (nodes.length) {
          case 3: {
            // Slider has chapter markers.
            this.slider = last;
            break;
          }
          case 2: {
            // Slider has no markers or auto-markers
            this.slider = last.querySelector('[idomkey=slider]');
            break;
          }
          default: {
            return; // no slider found yet
          }
        }

        console.debug('slider found...', this.slider);
        clearInterval(this.sliderInterval);
        this.sliderInterval = null;
        addSliderObserver(last);
        addSliderOverlay();
      }, 100);
    };

    this.sliderObserver = new MutationObserver((mutations) => {
      mutations.forEach((m) => {
        if (m.removedNodes) {
          for (const node of m.removedNodes) {
            if (node === this.sliderSegmentsOverlay) {
              console.debug('bringing back segments overlay');
              addSliderOverlay();
            }
            if (node === this.slider) {
              console.debug('slider removed, watching again');
              this.sliderObserver.disconnect();
              watchForSlider();
            }
          }
        }
      });
    });

    watchForSlider();
  }

  scheduleSkip() {
    clearTimeout(this.nextSkipTimeout);
    this.nextSkipTimeout = null;

    if (!this.active) {
      console.debug(this.videoID, 'No longer active, ignoring...');
      return;
    }

    if (this.video.paused) {
      console.debug(this.videoID, 'Currently paused, ignoring...');
      return;
    }

    // Sometimes timeupdate event (that calls scheduleSkip) gets fired right before
    // already scheduled skip routine below. Let's just look back a little bit
    // and, in worst case, perform a skip at negative interval (immediately)...
    const nextSegments = this.segments.filter(
      (seg) =>
        seg.segment[0] > this.video.currentTime - 0.3 &&
        seg.segment[1] > this.video.currentTime - 0.3
    );
    nextSegments.sort((s1, s2) => s1.segment[0] - s2.segment[0]);

    if (!nextSegments.length) {
      console.debug(this.videoID, 'No more segments');
      return;
    }

    const [segment] = nextSegments;
    const [start, end] = segment.segment;
    console.debug(
      this.videoID,
      'Scheduling skip of',
      segment,
      'in',
      start - this.video.currentTime
    );

    this.nextSkipTimeout = setTimeout(
      () => {
        if (this.video.paused) {
          console.debug(this.videoID, 'Currently paused, ignoring...');
          return;
        }
        if (!this.skippableCategories.includes(segment.category)) {
          console.debug(
            this.videoID,
            'Segment',
            segment.category,
            'is not skippable, ignoring...'
          );
          return;
        }

        const arabicUi = configRead('uiArabic') !== false;
        const skipName =
          (arabicUi ? barTypes[segment.category]?.ar : null) ||
          barTypes[segment.category]?.name ||
          segment.category;

        if (configRead('enableSponsorBlockManual')) {
          // Ask first: the YELLOW button skips (see ui.js), otherwise play on.
          console.debug(this.videoID, 'Offering skip of', segment);
          this.offerSkip(segment, skipName);
          return;
        }

        console.debug(this.videoID, 'Skipping', segment);
        showNotification(
          arabicUi ? `تخطّي: ${skipName}` : `Skipping ${skipName}`,
          2000,
          'indigo'
        );
        addSkipped(end - this.video.currentTime);
        this.video.currentTime = end;
        this.scheduleSkip();
      },
      (start - this.video.currentTime) * 1000
    );
  }

  /** Shows a "press YELLOW to skip" banner while inside the segment. */
  offerSkip(segment, skipName) {
    this.clearOffer();
    const [, end] = segment.segment;
    const arabic = configRead('uiArabic') !== false;

    const banner = document.createElement('div');
    banner.className = 'king-skip-prompt';
    banner.setAttribute('dir', arabic ? 'rtl' : 'ltr');
    banner.textContent = arabic
      ? `⏭ اضغط الأصفر لتخطّي (${skipName})`
      : `⏭ Press YELLOW to skip (${skipName})`;
    document.body.appendChild(banner);
    window.__kingSkipPrompt = true;

    const doSkip = () => {
      addSkipped(end - this.video.currentTime);
      this.video.currentTime = end;
      this.clearOffer();
      this.scheduleSkip();
    };
    const onYellow = () => doSkip();
    window.addEventListener('king-yellow', onYellow);

    // Hide the banner when the segment is over (played through or sought away).
    const watcher = setInterval(() => {
      if (
        !this.video ||
        this.video.currentTime >= end ||
        this.video.currentTime < segment.segment[0] - 1
      ) {
        this.clearOffer();
        this.scheduleSkip();
      }
    }, 500);

    this.offer = { banner, onYellow, watcher };
  }

  clearOffer() {
    if (!this.offer) return;
    window.removeEventListener('king-yellow', this.offer.onYellow);
    clearInterval(this.offer.watcher);
    this.offer.banner.remove();
    this.offer = null;
    window.__kingSkipPrompt = false;
  }

  destroy() {
    console.debug(this.videoID, 'Destroying');

    this.active = false;
    this.clearOffer();

    if (this.nextSkipTimeout) {
      clearTimeout(this.nextSkipTimeout);
      this.nextSkipTimeout = null;
    }

    if (this.attachVideoTimeout) {
      clearTimeout(this.attachVideoTimeout);
      this.attachVideoTimeout = null;
    }

    if (this.sliderInterval) {
      clearInterval(this.sliderInterval);
      this.sliderInterval = null;
    }

    if (this.sliderObserver) {
      this.sliderObserver.disconnect();
      this.sliderObserver = null;
    }

    if (this.sliderSegmentsOverlay) {
      this.sliderSegmentsOverlay.remove();
      this.sliderSegmentsOverlay = null;
    }

    if (this.video) {
      this.video.removeEventListener('play', this.scheduleSkipHandler);
      this.video.removeEventListener('pause', this.scheduleSkipHandler);
      this.video.removeEventListener('timeupdate', this.scheduleSkipHandler);
      this.video.removeEventListener(
        'durationchange',
        this.durationChangeHandler
      );
    }
  }
}

// When this global variable was declared using let and two consecutive hashchange
// events were fired (due to bubbling? not sure...) the second call handled below
// would not see the value change from first call, and that would cause multiple
// SponsorBlockHandler initializations... This has been noticed on Chromium 38.
// This either reveals some bug in chromium/webpack/babel scope handling, or
// shows my lack of understanding of javascript. (or both)
window.sponsorblock = null;

function uninitializeSponsorblock() {
  if (!window.sponsorblock) {
    return;
  }
  try {
    window.sponsorblock.destroy();
  } catch (err) {
    console.warn('window.sponsorblock.destroy() failed!', err);
  }
  window.sponsorblock = null;
}

window.addEventListener(
  'hashchange',
  () => {
    const newURL = new URL(location.hash.substring(1), location.href);
    // uninitialize sponsorblock when not on `/watch` path, to prevent
    // it from attaching to playback preview video element loaded on
    // home page
    if (newURL.pathname !== '/watch' && window.sponsorblock) {
      console.debug('uninitializing sponsorblock on a non-video page');
      uninitializeSponsorblock();
      return;
    }

    const videoID = newURL.searchParams.get('v');
    const needsReload =
      videoID &&
      (!window.sponsorblock || window.sponsorblock.videoID != videoID);

    console.debug(
      'hashchange',
      videoID,
      window.sponsorblock,
      window.sponsorblock ? window.sponsorblock.videoID : null,
      needsReload
    );

    if (needsReload) {
      uninitializeSponsorblock();

      if (configRead('enableSponsorBlock')) {
        window.sponsorblock = new SponsorBlockHandler(videoID);
        window.sponsorblock.init();
      } else {
        console.info('SponsorBlock disabled, not loading');
      }
    }
  },
  false
);
