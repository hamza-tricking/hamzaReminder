const test = require('node:test');
const assert = require('node:assert');
const { fromLocal, dayKey, formatTime } = require('../src/time');
const picker = require('../src/picker');

const OFF = 60; // Algeria, UTC+1
const now = fromLocal(2026, 9, 24, 10, 0, OFF); // 2026-10-24 10:00 local

const allButtons = (s) => s.reply_markup.inline_keyboard.flat();

test('local time converts to UTC and back', () => {
  const ms = fromLocal(2026, 9, 25, 9, 30, OFF);
  assert.strictEqual(dayKey(ms, OFF), '2026-10-25');
  assert.strictEqual(formatTime(ms, OFF), 'الأحد 2026-10-25 الساعة 09:30');
});

test('day screen has quick relative times, quick days and calendar', () => {
  const callbacks = allButtons(picker.dayScreen(now, OFF)).map((b) => b.callback_data);
  assert.ok(callbacks.includes('rel:60'));
  assert.ok(callbacks.includes('day:2026-10-24'));
  assert.ok(callbacks.includes('day:2026-10-25'));
  assert.ok(callbacks.includes('cal:0'));
});

test('hour screen disables hours that have already passed today', () => {
  const callbacks = allButtons(picker.hourScreen('2026-10-24', now, OFF)).map((b) => b.callback_data);
  assert.ok(!callbacks.includes('h:2026-10-24:09'));
  assert.ok(callbacks.includes('h:2026-10-24:10'));
});

test('calendar disables past days of the current month', () => {
  const buttons = allButtons(picker.calendarScreen(now, OFF, 0));
  assert.ok(buttons.find((b) => b.callback_data === 'day:2026-10-25'));
  assert.ok(!buttons.find((b) => b.callback_data === 'day:2026-10-23'));
});
