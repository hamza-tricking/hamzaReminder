// All times are stored as UTC milliseconds.
// Local wall-clock time uses a fixed offset in minutes (Algeria is UTC+1, no DST).
// Values produced by toLocal must be read with the getUTC* methods.

const AR_DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const AR_MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

const pad = (n) => String(n).padStart(2, '0');

const toLocal = (ms, offsetMin) => new Date(ms + offsetMin * 60000);

const fromLocal = (y, m, d, h, min, offsetMin) => Date.UTC(y, m, d, h, min) - offsetMin * 60000;

// "2026-10-25" for the local calendar day that contains ms
const dayKey = (ms, offsetMin) => {
  const d = toLocal(ms, offsetMin);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
};

const parseDay = (key) => {
  const [y, m, d] = key.split('-').map(Number);
  return { y, m: m - 1, d };
};

const weekday = (key) => {
  const { y, m, d } = parseDay(key);
  return new Date(Date.UTC(y, m, d)).getUTCDay();
};

// Example: "الاثنين 26"
const dayLabel = (key) => `${AR_DAYS[weekday(key)]} ${parseDay(key).d}`;

// Example: "الأحد 2026-10-25 الساعة 09:30"
const formatTime = (ms, offsetMin) => {
  const d = toLocal(ms, offsetMin);
  const key = dayKey(ms, offsetMin);
  return `${AR_DAYS[weekday(key)]} ${key} الساعة ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
};

module.exports = {
  AR_DAYS,
  AR_MONTHS,
  pad,
  toLocal,
  fromLocal,
  dayKey,
  parseDay,
  weekday,
  dayLabel,
  formatTime,
};
