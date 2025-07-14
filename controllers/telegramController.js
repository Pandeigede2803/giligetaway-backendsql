// controllers/telegramTestController.js
const axios = require("axios");

/**
 * Kirim pesan uji ke Telegram menggunakan token & chat_id dari .env
 * GET  /telegram/test?msg=Halo
 */
exports.testTelegram = async (req, res) => {
  const token   = process.env.TELEGRAM_BOT_TOKEN;
  const chatId  = process.env.TELEGRAM_CHAT_ID;
  const message = req.query.msg || "✅ Test pesan dari Express";

  if (!token || !chatId) {
    return res.status(500).json({ success: false, error: "Token/ChatID not set" });
  }

  try {
    await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
      chat_id: chatId,
      text: message,
      parse_mode: "HTML",
    });
    return res.json({ success: true, message: "Sent to Telegram" });
  } catch (err) {
    console.error("Telegram send failed:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
};