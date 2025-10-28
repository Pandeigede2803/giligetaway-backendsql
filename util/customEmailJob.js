const cron = require("node-cron");
const { runCustomEmailJob } = require("../controllers/customEmailSchedulerController");
const { sendTelegramMessage } = require("./telegram");

const scheduleCustomEmailJob = () => {
  const cronFrequency = process.env.CRON_FREQUENCY_CUSTOM_EMAIL || "*/40 * * * *"; // Default tiap 10 menit

  console.log(`📆 Registering CustomEmailCron with frequency: ${cronFrequency}`);

  cron.schedule(cronFrequency, async () => {
    console.log("🕒 Running scheduled custom email job...");

    try {
      // Jalankan langsung fungsi controllernya, tanpa HTTP request
      // Simulasikan req & res sederhana biar kompatibel
      const fakeReq = { query: {}, body: {} };
      const fakeRes = {
        json: (data) => {
          console.log("✅ CustomEmailCron executed:", data.message || data);
          // Send success notification to Telegram
          sendTelegramMessage(
            `✅ <b>Custom Email Job Success</b>\n\n${data.message || JSON.stringify(data)}\n\nTime: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}`
          );
        },
        status: (code) => ({
          json: (data) => {
            console.log(`❌ Error ${code} - ${data.message || JSON.stringify(data)}`);
            // Send error notification to Telegram
            sendTelegramMessage(
              `❌ <b>Custom Email Job Error</b>\n\nStatus: ${code}\nError: ${data.message || JSON.stringify(data)}\n\nTime: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}`
            );
          }
        })
      };

      await runCustomEmailJob(fakeReq, fakeRes);;
    } catch (err) {
      console.error("❌ Error in CustomEmailCron:", err.message);
      // Send exception notification to Telegram
      await sendTelegramMessage(
        `❌ <b>Custom Email Job Exception</b>\n\nError: ${err.message}\n\nTime: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}`
      );
    }
  });
};

module.exports = { scheduleCustomEmailJob };