const cron = require("node-cron");
const {
  findDuplicateSeats,
  notifyTelegram,
} = require("../controllers/seatAvailabilityController");

const scheduleDuplicateSeatJob = () => {
  const cronFrequency =
    process.env.CRON_FREQUENCY_SEAT_DUPLICATE || "0 */1 * * *"; // Default to every hour if not set

  console.log(`📆 Registering DuplicateSeatCron with frequency: ${cronFrequency}`);

 cron.schedule(cronFrequency, async () => {
  console.log("🕒 Running scheduled duplicate seat checker...");
  try {
    const duplicates = await findDuplicateSeats();
    console.log(`🔍 Found ${duplicates.length} duplicate seats.`) ;

    console.log("📡 Sending duplicate seat report to Telegram...");
    await notifyTelegram(duplicates); // ⬅️ PASTIKAN INI ADA
    console.log("✅ Duplicate seat check done.");
  } catch (err) {
    console.error("❌ Error in DuplicateSeatCron:", err);
  }
});
};

module.exports = {
  scheduleDuplicateSeatJob,
};