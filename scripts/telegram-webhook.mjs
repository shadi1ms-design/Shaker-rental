#!/usr/bin/env node
/**
 * Telegram webhook helper (diagnose / register / remove).
 *
 *   TELEGRAM_BOT_TOKEN=123:ABC node scripts/telegram-webhook.mjs info
 *   TELEGRAM_BOT_TOKEN=123:ABC TELEGRAM_WEBHOOK_SECRET=mysecret \
 *     node scripts/telegram-webhook.mjs set https://asia-south1-shaker-rentalcars.cloudfunctions.net/telegramWebhook
 *   TELEGRAM_BOT_TOKEN=123:ABC node scripts/telegram-webhook.mjs delete
 *
 * - "info" prints what Telegram itself reports (current URL, pending updates and the LAST ERROR it got
 *   from the function) - this is the fastest way to see why the ✅ تأكيد button does nothing.
 * - TELEGRAM_WEBHOOK_SECRET must be EXACTLY the value stored in the Firebase secret TELEGRAM_WEBHOOK_SECRET
 *   (letters, digits, "_" and "-" only, max 256 chars).
 * - The URL is shown in the Firebase console / `firebase deploy` output for the function `telegramWebhook`.
 */
const [, , command = 'info', urlArg] = process.argv;
const token = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
const secret = (process.env.TELEGRAM_WEBHOOK_SECRET || '').trim();

if (!token) {
  console.error('Set TELEGRAM_BOT_TOKEN first.');
  process.exit(1);
}

async function api(method, body) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  return res.json();
}

if (command === 'info') {
  const me = await api('getMe');
  console.log('Bot:', me.ok ? `@${me.result.username}` : me);
  const info = await api('getWebhookInfo');
  console.log(JSON.stringify(info.result, null, 2));
  const r = info.result || {};
  if (!r.url) console.log('\n=> No webhook is registered. Run the "set" command.');
  if (r.last_error_message) {
    console.log(`\n=> Telegram's last error: ${r.last_error_message}`);
    console.log('   401 = secret mismatch / registered without secret | 404 = wrong URL or function not deployed');
    console.log('   403 = function is not public (invoker) | 5xx/timeout = function crashed, check Cloud Logging');
  }
} else if (command === 'set') {
  if (!urlArg || !urlArg.startsWith('https://')) {
    console.error('Usage: set https://<function-url>');
    process.exit(1);
  }
  if (!secret) {
    console.error('Set TELEGRAM_WEBHOOK_SECRET (same value as the Firebase secret). Without it every request is rejected with 401.');
    process.exit(1);
  }
  console.log(await api('setWebhook', {
    url: urlArg,
    secret_token: secret,
    allowed_updates: ['callback_query'],
    drop_pending_updates: true,
  }));
} else if (command === 'delete') {
  console.log(await api('deleteWebhook', { drop_pending_updates: true }));
} else {
  console.error('Commands: info | set <url> | delete');
  process.exit(1);
}
