// Builds the time-picker screens. Each button carries its full meaning in callback_data,
// so the bot needs no stored step: a press always says what was chosen.
//
// callback_data:
//   rel:<minutes>          relative time from now
//   day:<YYYY-MM-DD>       chosen day
//   cal:<monthOffset>      calendar for a month (0 = this month)
//   h:<day>:<HH>           chosen hour
//   m:<day>:<HH>:<MM>      chosen minute (ready to confirm)
//   ok:<dueMs>             confirm reminder at this UTC time
//   back                   return to the day screen
//   noop                   disabled button

const { AR_MONTHS, pad, toLocal, fromLocal, dayKey, parseDay, dayLabel, formatTime } = require('./time');

const DAY = 86400000;
const MIN = 60000;

const btn = (text, callback_data) => ({ text, callback_data });

const chunk = (items, size) => {
  const rows = [];
  for (let i = 0; i < items.length; i += size) rows.push(items.slice(i, i + size));
  return rows;
};

const screen = (text, rows) => ({ text, reply_markup: { inline_keyboard: rows } });

function dayScreen(now, off) {
  const keys = Array.from({ length: 10 }, (_, i) => dayKey(now + i * DAY, off));

  const relative = [btn('بعد 10 دقائق', 'rel:10'), btn('بعد ساعة', 'rel:60'), btn('بعد ساعتين', 'rel:120')];
  const quick = [btn('اليوم', `day:${keys[0]}`), btn('غداً', `day:${keys[1]}`), btn('بعد يومين', `day:${keys[2]}`)];
  const upcoming = keys.slice(3).map((k) => btn(dayLabel(k), `day:${k}`));

  return screen('📅 اختر اليوم، أو اختر وقتاً سريعاً:', [
    relative,
    quick,
    ...chunk(upcoming, 4),
    [btn('📅 تقويم', 'cal:0')],
  ]);
}

function calendarScreen(now, off, monthOffset) {
  const local = toLocal(now, off);
  const first = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth() + monthOffset, 1));
  const y = first.getUTCFullYear();
  const m = first.getUTCMonth();
  const daysInMonth = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const todayKey = dayKey(now, off);

  const cells = [];
  for (let i = 0; i < first.getUTCDay(); i++) cells.push(btn(' ', 'noop'));
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${y}-${pad(m + 1)}-${pad(d)}`;
    cells.push(key < todayKey ? btn('·', 'noop') : btn(String(d), `day:${key}`));
  }
  while (cells.length % 7) cells.push(btn(' ', 'noop'));

  const nav = [
    monthOffset < 11 ? btn('التالي ▶', `cal:${monthOffset + 1}`) : btn(' ', 'noop'),
    btn(`${AR_MONTHS[m]} ${y}`, 'noop'),
    monthOffset > 0 ? btn('◀ السابق', `cal:${monthOffset - 1}`) : btn(' ', 'noop'),
  ];
  const header = ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'].map((n) => btn(n, 'noop'));

  return screen('📅 اختر التاريخ:', [nav, header, ...chunk(cells, 7), [btn('⬅ رجوع', 'back')]]);
}

function hourScreen(key, now, off) {
  const { y, m, d } = parseDay(key);
  const hours = Array.from({ length: 24 }, (_, h) => {
    const past = fromLocal(y, m, d, h, 59, off) <= now;
    return past ? btn('·', 'noop') : btn(pad(h), `h:${key}:${pad(h)}`);
  });
  return screen(`🕐 ${dayLabel(key)}: اختر الساعة`, [...chunk(hours, 6), [btn('⬅ رجوع', 'back')]]);
}

function minuteScreen(key, hour, now, off) {
  const { y, m, d } = parseDay(key);
  const minutes = Array.from({ length: 12 }, (_, i) => i * 5).map((mi) => {
    const past = fromLocal(y, m, d, hour, mi, off) <= now;
    return past ? btn('·', 'noop') : btn(pad(mi), `m:${key}:${pad(hour)}:${pad(mi)}`);
  });
  return screen(`⏱ ${dayLabel(key)} الساعة ${pad(hour)}: اختر الدقائق`, [
    ...chunk(minutes, 4),
    [btn('⬅ رجوع', 'back')],
  ]);
}

function confirmScreen(dueAt, off) {
  return screen(`✅ سأذكّرك:\n${formatTime(dueAt, off)}\nهل توافق؟`, [
    [btn('✅ تأكيد', `ok:${dueAt}`)],
    [btn('🔁 تغيير', 'back')],
  ]);
}

module.exports = { dayScreen, calendarScreen, hourScreen, minuteScreen, confirmScreen, MIN };
