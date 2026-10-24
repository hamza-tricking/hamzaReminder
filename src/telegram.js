const API = 'https://api.telegram.org';

async function call(token, method, body = {}) {
  const res = await fetch(`${API}/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(`${method}: ${data.description}`);
  return data.result;
}

const getUpdates = (token, offset, timeout) =>
  call(token, 'getUpdates', { offset, timeout, allowed_updates: ['message', 'callback_query'] });

const sendMessage = (token, chatId, text, extra = {}) =>
  call(token, 'sendMessage', { chat_id: chatId, text, ...extra });

// Editing can fail when the text did not change. That is harmless, so ignore it.
const editMessage = (token, chatId, messageId, text, extra = {}) =>
  call(token, 'editMessageText', { chat_id: chatId, message_id: messageId, text, ...extra }).catch(() => null);

// Copies any message type (text, voice, video, photo, file...) without a "forwarded" label.
const copyMessage = (token, chatId, fromChatId, messageId, extra = {}) =>
  call(token, 'copyMessage', { chat_id: chatId, from_chat_id: fromChatId, message_id: messageId, ...extra });

const answerCallback = (token, callbackId, text, showAlert = false) =>
  call(token, 'answerCallbackQuery', { callback_query_id: callbackId, text, show_alert: showAlert }).catch(() => null);

module.exports = { getUpdates, sendMessage, editMessage, copyMessage, answerCallback };
