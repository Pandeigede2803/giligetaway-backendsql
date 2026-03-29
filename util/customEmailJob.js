const cron = require("node-cron");
const { runCustomEmailJob } = require("../controllers/customEmailSchedulerController");
const { sendTelegramMessage } = require("./telegram");

let isRunning = false;

const runCustomEmailJobTask = async () => {
  if (isRunning) {
    console.warn("⏳ CustomEmailCron: previous run still in progress, skip run");
    return { skipped: true, reason: "already_running" };
  }
  isRunning = true;
  console.log("🕒 Running scheduled custom email job...");

  try {
    const fakeReq = { query: {}, body: {} };
    const fakeRes = {
      json: (data) => {
        console.log("✅ CustomEmailCron executed:", data.message || data);
        sendTelegramMessage(
          `✅ <b>Custom Email Job Success</b>\n\n${data.message || JSON.stringify(data)}\n\nTime: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}`
        );
      },
      status: (code) => ({
        json: (data) => {
          const detailMessage = [data?.message, data?.error].filter(Boolean).join(" | ");
          console.log(`❌ Error ${code} - ${detailMessage || JSON.stringify(data)}`);
          sendTelegramMessage(
            `❌ <b>Custom Email Job Error</b>\n\nStatus: ${code}\nError: ${detailMessage || JSON.stringify(data)}\n\nTime: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}`
          );
        }
      })
    };

    await runCustomEmailJob(fakeReq, fakeRes);
    return { skipped: false };
  } catch (err) {
    console.error("❌ Error in CustomEmailCron:", err.message);
    await sendTelegramMessage(
      `❌ <b>Custom Email Job Exception</b>\n\nError: ${err.message}\n\nTime: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}`
    );
    throw err;
  } finally {
    isRunning = false;
  }
};

const scheduleCustomEmailJob = () => {
  const cronFrequency = process.env.CRON_FREQUENCY_CUSTOM_EMAIL || "11 */5 * * *"; // Default tiap 5 jam, minute-offset 11

  console.log(`📆 Registering CustomEmailCron with frequency: ${cronFrequency}`);

  cron.schedule(cronFrequency, async () => {
    await runCustomEmailJobTask();
  });
};

module.exports = {
  scheduleCustomEmailJob,
  runCustomEmailJobTask,
};
