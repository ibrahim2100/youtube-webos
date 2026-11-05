// Counts how much time SponsorBlock skips saved (stored locally on the TV only).
const KEY = 'king-sb-stats';

export function readSbStats() {
  try {
    const v = JSON.parse(window.localStorage.getItem(KEY) || '{}');
    return { seconds: Number(v.seconds) || 0, count: Number(v.count) || 0 };
  } catch {
    return { seconds: 0, count: 0 };
  }
}

export function addSkipped(seconds) {
  if (!(seconds > 0)) return;
  const s = readSbStats();
  s.seconds += seconds;
  s.count += 1;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // storage may be unavailable; stats are optional
  }
}

export function resetSbStats() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

export function formatSbStats(arabic) {
  const { seconds, count } = readSbStats();
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const sec = Math.round(seconds % 60);
  let time;
  if (arabic) {
    time = h ? `${h} س ${m} د` : m ? `${m} د ${sec} ث` : `${sec} ث`;
    return `وفّرت لك المقاطع المتخطّاة ${time} (${count} مقطع)`;
  }
  time = h ? `${h} h ${m} min` : m ? `${m} min ${sec} s` : `${sec} s`;
  return `Skipping saved you ${time} (${count} segments)`;
}
