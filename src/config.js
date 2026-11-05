const CONFIG_KEY = 'ytaf-configuration';

/**
 * `desc` is the English label (kept for compatibility), `ar` the Arabic one.
 * `group` decides the section of the settings screen.
 */
const configOptions = new Map([
  [
    'enableAdBlock',
    {
      default: true,
      desc: 'Enable ad blocking',
      ar: 'حظر الإعلانات',
      group: 'general'
    }
  ],
  [
    'upgradeThumbnails',
    {
      default: false,
      desc: 'Upgrade thumbnail quality',
      ar: 'صور مصغّرة بجودة أعلى',
      group: 'general'
    }
  ],
  [
    'hideLogo',
    {
      default: false,
      desc: 'Hide YouTube logo',
      ar: 'إخفاء شعار يوتيوب',
      group: 'general'
    }
  ],
  [
    'showWatch',
    {
      default: false,
      desc: 'Display time in UI',
      ar: 'عرض الساعة على الشاشة',
      group: 'general'
    }
  ],
  [
    'autoAccountSelect',
    {
      default: false,
      desc: 'Bypass initial account selection on startup',
      ar: 'تخطّي اختيار الحساب عند التشغيل',
      group: 'general'
    }
  ],
  [
    'forceHighResVideo',
    {
      default: false,
      desc: 'Force max resolution video playback',
      ar: 'أعلى دقة متاحة دائماً',
      group: 'video'
    }
  ],
  [
    'removeEndscreen',
    {
      default: false,
      desc: 'Remove end screens from video',
      ar: 'إزالة شاشات نهاية الفيديو',
      group: 'video'
    }
  ],
  [
    'removeShorts',
    {
      default: false,
      desc: 'Remove Shorts everywhere (home, search, subscriptions)',
      ar: 'إزالة Shorts من كل الصفحات',
      group: 'video'
    }
  ],
  [
    'enableSponsorBlock',
    {
      default: true,
      desc: 'Enable SponsorBlock',
      ar: 'تفعيل SponsorBlock',
      group: 'sponsor'
    }
  ],
  [
    'enableSponsorBlockSponsor',
    {
      default: true,
      desc: 'Skip sponsor segments',
      ar: 'تخطّي الرعاة',
      group: 'sponsor'
    }
  ],
  [
    'enableSponsorBlockIntro',
    {
      default: true,
      desc: 'Skip intro segments',
      ar: 'تخطّي المقدمة',
      group: 'sponsor'
    }
  ],
  [
    'enableSponsorBlockOutro',
    {
      default: true,
      desc: 'Skip outro segments',
      ar: 'تخطّي الخاتمة',
      group: 'sponsor'
    }
  ],
  [
    'enableSponsorBlockInteraction',
    {
      default: true,
      desc: 'Skip interaction reminder segments',
      ar: 'تخطّي «اشترك وفعّل الجرس»',
      group: 'sponsor'
    }
  ],
  [
    'enableSponsorBlockSelfPromo',
    {
      default: true,
      desc: 'Skip self promotion segments',
      ar: 'تخطّي الترويج الذاتي',
      group: 'sponsor'
    }
  ],
  [
    'enableSponsorBlockMusicOfftopic',
    {
      default: true,
      desc: 'Skip non-music segments in music videos',
      ar: 'تخطّي الأجزاء غير الموسيقية',
      group: 'sponsor'
    }
  ],
  [
    'enableSponsorBlockPreview',
    {
      default: false,
      desc: 'Skip recaps and previews',
      ar: 'تخطّي الملخّصات والمعاينات',
      group: 'sponsor'
    }
  ],
  [
    'enableStats',
    {
      default: true,
      desc: 'Video stats on the RED button',
      ar: 'إحصائيات الفيديو بالزر الأحمر',
      group: 'video'
    }
  ],
  [
    'enableSponsorBlockManual',
    {
      default: false,
      desc: 'Ask before skipping (press YELLOW to skip)',
      ar: 'اسألني قبل التخطّي (الأصفر للتخطّي)',
      group: 'sponsor'
    }
  ],
  [
    'enableDeArrow',
    {
      default: true,
      desc: 'Enable DeArrow',
      ar: 'تفعيل DeArrow',
      group: 'dearrow'
    }
  ],
  [
    'deArrowTitles',
    {
      default: true,
      desc: 'Honest titles (no clickbait)',
      ar: 'عناوين صادقة بدون تضليل',
      group: 'dearrow'
    }
  ],
  [
    'deArrowThumbnails',
    {
      default: true,
      desc: 'Honest thumbnails',
      ar: 'صور مصغّرة صادقة',
      group: 'dearrow'
    }
  ],
  [
    'uiArabic',
    {
      default: true,
      desc: 'Arabic interface',
      ar: 'الواجهة بالعربية',
      group: 'interface'
    }
  ]
]);

const defaultConfig = (() => {
  let ret = {};
  for (const [k, v] of configOptions) {
    ret[k] = v.default;
  }
  return ret;
})();

/** @type {Record<string, DocumentFragment>} as const */
const configFrags = (() => {
  let ret = {};
  for (const k of configOptions.keys()) {
    ret[k] = new DocumentFragment();
  }
  return ret;
})();

function loadStoredConfig() {
  const storage = window.localStorage.getItem(CONFIG_KEY);

  if (storage === null) {
    console.info('Config not set; using defaults.');
    return null;
  }

  try {
    return JSON.parse(storage);
  } catch (err) {
    console.warn('Error parsing stored config:', err);
    return null;
  }
}

// Use defaultConfig as a prototype so writes to localConfig don't change it.
let localConfig = loadStoredConfig() ?? Object.create(defaultConfig);

function configExists(key) {
  return configOptions.has(key);
}

export function configGetLabel(key, arabic) {
  if (!configExists(key)) {
    throw new Error('tried to get label for unknown config key: ' + key);
  }

  const o = configOptions.get(key);
  return arabic && o.ar ? o.ar : o.desc;
}

export function configGetDesc(key) {
  if (!configExists(key)) {
    throw new Error('tried to get desc for unknown config key: ' + key);
  }

  return configOptions.get(key).desc;
}

export function configRead(key) {
  if (!configExists(key)) {
    throw new Error('tried to read unknown config key: ' + key);
  }

  if (localConfig[key] === undefined) {
    console.warn(
      'Populating key',
      key,
      'with default value',
      defaultConfig[key]
    );

    localConfig[key] = defaultConfig[key];
  }

  return localConfig[key];
}

export function configWrite(key, value) {
  if (!configExists(key)) {
    throw new Error('tried to write unknown config key: ' + key);
  }

  const oldValue =
    localConfig[key] !== undefined ? localConfig[key] : defaultConfig[key];

  console.info('Changing key', key, 'from', oldValue, 'to', value);
  localConfig[key] = value;
  window.localStorage[CONFIG_KEY] = JSON.stringify(localConfig);

  configFrags[key].dispatchEvent(
    new CustomEvent('ytafConfigChange', {
      detail: { key, newValue: value, oldValue }
    })
  );
}

/**
 * Add a listener for changes in the value of a specified config option
 * @param {string} key Config option to monitor
 * @param {(evt: Event) => void} callback Function to be called on change
 */
export function configAddChangeListener(key, callback) {
  const frag = configFrags[key];

  frag.addEventListener('ytafConfigChange', callback);
}

/**
 * Remove a listener for changes in the value of a specified config option
 * @param {string} key Config option to monitor
 * @param {(evt: Event) => void} callback Function to be called on change
 */
export function configRemoveChangeListener(key, callback) {
  const frag = configFrags[key];

  frag.removeEventListener('ytafConfigChange', callback);
}
