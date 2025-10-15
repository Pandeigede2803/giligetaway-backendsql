const axios = require("axios");

/**
 * Kirim notifikasi error ke Telegram
 */
const sendTelegramError = async (message) => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) return;

  try {
    await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
      chat_id: chatId,
      text: message,
      parse_mode: "HTML",
    });
  } catch (err) {
    console.error("❌ Failed to notify Telegram:", err.message);
  }
};

/**
 * Kirim event purchase ke GA4 (server-side) via Measurement Protocol
 */
/**
 * Kirim notifikasi error ke Telegram
 */


/**
 * Kirim event purchase ke GA4 (server-side) via Measurement Protocol
 * versi ini PASTI muncul di DebugView karena pakai debug_mode
 */
const sendPurchaseToGA4 = async (transactionId, amount, currency = "IDR") => {
  const measurementId = "G-S3KMXQ5D41"; // ID GA4 stream kamu
  const apiSecret = process.env.GA4_API_SECRET; // pastikan isi .env-nya
  console.log("🚀 GA4 Tracking:",apiSecret);

  if (!transactionId || !amount) {
    console.warn("⚠️ [GA4] Skipped: missing transactionId or amount");
    return;
  }

  // client_id HARUS unik + debug_mode true agar kelihatan di DebugView
  const payload = {
    client_id: `${Date.now()}.${Math.floor(Math.random() * 1000000)}`,
    user_id: transactionId, // optional
 
    events: [
      {
        name: "purchase",
        params: {
          transaction_id: transactionId,
          value: parseFloat(amount),
          currency,
             debug_mode: true,
        },
      },
    ],
  };

 const url = `https://www.google-analytics.com/debug/mp/collect?measurement_id=${measurementId}&api_secret=${apiSecret}`;

  try {
    const res = await axios.post(url, payload, {
      headers: { "Content-Type": "application/json" },
      timeout: 5000,
    });
      console.log("🛰️ GA4 Debug Response:", JSON.stringify(res.data, null, 2)); // <–– tambahkan ini
  console.log("GA4 Status:", res.status, res.statusText);

    if (res.status === 204) {
      console.log(`📊 [GA4] Purchase event sent: ${transactionId} (${currency} ${amount})`);
    } else {
      const msg = `⚠️ [GA4] Unexpected response: ${res.status} for ${transactionId}`;
      console.warn(msg);
      await sendTelegramError(msg);
    }
  } catch (err) {
    const errorMsg = `🚨 [GA4] Error for ${transactionId}: ${err.response?.data || err.message}`;
    console.error(errorMsg);
    await sendTelegramError(errorMsg);
    // Jangan throw biar booking tetap lanjut
  }
};


module.exports = { sendPurchaseToGA4 };