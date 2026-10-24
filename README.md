# reminder-bot

A Telegram bot for personal reminders. Send it anything (text, voice, video, photo, file),
pick a day and time with buttons, and it sends your message back at that time.
It repeats every 5 minutes until you press "تم، شفت التذكير", or stops after 2 hours.

## Commands
- Any message: starts a new reminder.
- `/list`: shows upcoming reminders, each with a delete button.

## Setup (once)
1. In Telegram, open @BotFather, send `/newbot`, and copy the token.
2. Put the token in `.env` on the server (`TELEGRAM_BOT_TOKEN`).
3. Send `/start` to your bot. It replies with your chat id.
4. Put that id in `TELEGRAM_CHAT_ID` in `.env`, then run `pm2 restart reminder-bot --update-env`.

## Run
- Local: `npm install`, then `npm start`. Tests: `npm test`.
- Server: `pm2 logs reminder-bot`

## Settings
See `.env.example`: `TZ_OFFSET_MIN`, `REPEAT_EVERY_MIN`, `MAX_REPEAT_MIN`.
