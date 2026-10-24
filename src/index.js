require('dotenv').config();

const fs = require('fs');
const path = require('path');
const telegram = require('./telegram');
const picker = require('./picker');
const { formatTime, fromLocal } = require('./time');

const env = {
  token: process.env.TELEGRAM_BOT_TOKEN,
  chatId: process.env.TELEGRAM_CHAT_ID || '',
  tzOffsetMin: Number(process.env.TZ_OFFSET_MIN || 60),
  repeatEveryMin: Number(process.env.REPEAT_EVERY_MIN || 5),
  maxRepeatMin: Number(process.env.MAX_REPEAT_MIN || 120),
};

const MIN = 60000;
const STATE_FILE = path.join(__dirname, '..', 'state.json');

function log(...args) {
  console.log(new Date().toISOString(), ...args);
}

function loadState() {
  const defaults = { offset: 0, drafts: {}, reminders: [] };
  try {
    return { ...defaults, ...JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) };
  } catch {
    return defaults;
  }
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

const reply = (text, extra) => telegram.sendMessage(env.token, env.chatId, text, extra);

async function showList(state) {
  const open = state.reminders.filter((r) => r.status === 'pending' || r.status === 'active');
  if (open.length === 0) return reply('لا توجد تذكيرات قادمة.');
  const rows = open.map((r) => [{ text: `🗑 ${formatTime(r.dueAt, env.tzOffsetMin)}`, callback_data: `del:${r.id}` }]);
  return reply('📋 التذكيرات القادمة (اضغط للحذف):', { reply_markup: { inline_keyboard: rows } });
}

// Any message that is not a command starts a new reminder: the message itself is what gets sent back.
async function onMessage(state, msg) {
  const chatId = String(msg.chat.id);

  if (!env.chatId) {
    if (msg.text === '/start') {
      await telegram.sendMessage(
        env.token,
        chatId,
        `مرحباً! رقم المحادثة هو: ${chatId}\nضعه في TELEGRAM_CHAT_ID داخل .env ثم أعد التشغيل.`,
      );
    }
    return;
  }
  if (chatId !== env.chatId) return;

  if (msg.text === '/start') {
    return reply('أرسل أي شيء (نص أو صوت أو صورة أو فيديو أو ملف)، ثم اختر وقت التذكير.');
  }
  if (msg.text === '/list') return showList(state);

  state.drafts[chatId] = { messageId: msg.message_id };
  const s = picker.dayScreen(Date.now(), env.tzOffsetMin);
  await telegram.sendMessage(env.token, chatId, s.text, {
    reply_markup: s.reply_markup,
    reply_to_message_id: msg.message_id,
  });
}

async function onCallback(state, cb) {
  const chatId = String(cb.message?.chat.id ?? '');
  if (chatId !== env.chatId) return telegram.answerCallback(env.token, cb.id);

  const [kind, ...args] = cb.data.split(':');
  const now = Date.now();
  const off = env.tzOffsetMin;

  // Reminder buttons live on the copied message, and the list buttons live on the list message.
  if (kind === 'done') {
    const r = state.reminders.find((x) => x.id === args[0]);
    if (r && r.status === 'active') r.status = 'done';
    return telegram.answerCallback(env.token, cb.id, r ? '✅ تم' : 'انتهى هذا التذكير');
  }
  if (kind === 'del') {
    const r = state.reminders.find((x) => x.id === args[0]);
    if (r && (r.status === 'pending' || r.status === 'active')) r.status = 'cancelled';
    await telegram.editMessage(env.token, chatId, cb.message.message_id, '🗑 تم حذف التذكير.', {
      reply_markup: { inline_keyboard: [] },
    });
    return telegram.answerCallback(env.token, cb.id);
  }

  // Picker buttons edit the picker message in place.
  const pickerId = cb.message.message_id;
  const show = (s) => telegram.editMessage(env.token, chatId, pickerId, s.text, { reply_markup: s.reply_markup });

  switch (kind) {
    case 'noop':
      break;
    case 'back':
      await show(picker.dayScreen(now, off));
      break;
    case 'cal':
      await show(picker.calendarScreen(now, off, Number(args[0])));
      break;
    case 'day':
      await show(picker.hourScreen(args[0], now, off));
      break;
    case 'h':
      await show(picker.minuteScreen(args[0], Number(args[1]), now, off));
      break;
    case 'rel':
      await show(picker.confirmScreen(now + Number(args[0]) * MIN, off));
      break;
    case 'm': {
      const [y, m, d] = args[0].split('-').map(Number);
      const due = fromLocal(y, m - 1, d, Number(args[1]), Number(args[2]), off);
      if (due <= now) {
        return telegram.answerCallback(env.token, cb.id, 'هذا الوقت مضى، اختر وقتاً لاحقاً', true);
      }
      await show(picker.confirmScreen(due, off));
      break;
    }
    case 'ok': {
      const draft = state.drafts[chatId];
      const due = Number(args[0]);
      if (!draft) {
        return telegram.answerCallback(env.token, cb.id, 'أرسل الرسالة من جديد', true);
      }
      if (due <= now) {
        return telegram.answerCallback(env.token, cb.id, 'هذا الوقت مضى، اختر وقتاً لاحقاً', true);
      }
      state.reminders.push({
        id: newId(),
        chatId,
        fromMessageId: draft.messageId,
        dueAt: due,
        status: 'pending',
        startedAt: 0,
        nextAt: 0,
      });
      delete state.drafts[chatId];
      await telegram.editMessage(env.token, chatId, pickerId, `✅ تم الحفظ: ${formatTime(due, off)}`, {
        reply_markup: { inline_keyboard: [] },
      });
      break;
    }
    default:
      break;
  }

  await telegram.answerCallback(env.token, cb.id);
}

// Sends each due reminder, then repeats it every few minutes until the button is pressed.
async function sendDue(state) {
  const now = Date.now();
  for (const r of state.reminders) {
    if (r.status === 'pending' && r.dueAt <= now) {
      r.status = 'active';
      r.startedAt = now;
      r.nextAt = now;
    }
    if (r.status !== 'active' || r.nextAt > now) continue;

    if (now - r.startedAt >= env.maxRepeatMin * MIN) {
      r.status = 'expired';
      await reply(`⚠️ انتهت مدة التذكير (${env.maxRepeatMin} دقيقة) دون تأكيد.`);
      continue;
    }

    try {
      await telegram.copyMessage(env.token, r.chatId, r.chatId, r.fromMessageId, {
        reply_markup: { inline_keyboard: [[{ text: '✅ تم، شفت التذكير', callback_data: `done:${r.id}` }]] },
      });
      log(`reminder ${r.id} sent`);
    } catch (err) {
      log('send failed:', err.message);
      r.status = 'expired';
      continue;
    }
    r.nextAt = now + env.repeatEveryMin * MIN;
  }
}

async function handleUpdate(state, update) {
  if (update.message) return onMessage(state, update.message);
  if (update.callback_query) return onCallback(state, update.callback_query);
}

async function main() {
  if (!env.token) {
    throw new Error('TELEGRAM_BOT_TOKEN is missing in .env');
  }

  const state = loadState();
  log('reminder-bot started');

  while (true) {
    try {
      const updates = await telegram.getUpdates(env.token, state.offset, 5);
      for (const update of updates) {
        state.offset = update.update_id + 1;
        try {
          await handleUpdate(state, update);
        } catch (err) {
          log('update failed:', err.message);
        }
      }
    } catch (err) {
      log('poll failed:', err.message);
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }

    try {
      await sendDue(state);
    } catch (err) {
      log('due failed:', err.message);
    }
    saveState(state);
  }
}

main().catch((err) => {
  log('fatal:', err.message);
  process.exit(1);
});
