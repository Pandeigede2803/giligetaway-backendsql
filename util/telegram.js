// utils/telegram.js
const axios = require('axios');

const TOKEN  = process.env.TELEGRAM_BOT_TOKEN;
const CHATID = process.env.TELEGRAM_CHAT_ID;

/** Minimal Telegram sender used in several places */
exports.sendTelegramMessage = async (text) => {
  if (!TOKEN || !CHATID) {
    console.warn('🔔 Telegram token / chat-id missing – skipping send');
    return;
  }

  try {
    await axios.post(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
      chat_id: CHATID,
      text,
      parse_mode: 'HTML',
    });
  } catch (err) {
    console.error('❌ Failed to send Telegram message:', err.message);
  }
};