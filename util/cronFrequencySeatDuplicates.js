const cron = require("node-cron");
const {
  findDuplicateSeats,
  notifyTelegram,
  findBoostedSeats,
  notifyTelegramSeatBoosted,
} = require("../controllers/seatAvailabilityController");

const scheduleDuplicateSeatJob = () => {
  const cronFrequency =
    process.env.CRON_FREQUENCY_SEAT_DUPLICATE || "0 */1 * * *"; // Default to every hour if not set

  // console.log(`📆 Registering DuplicateSeatCron with frequency: ${cronFrequency}`);

 cron.schedule(cronFrequency, async () => {
  console.log("🕒 Running scheduled duplicate seat checker...");
  try {
    const duplicates = await findDuplicateSeats();
    // console.log(`🔍 Found ${duplicates.length} duplicate seats.`) ;

    // console.log("📡 Sending duplicate seat report to Telegram...");
    await notifyTelegram(duplicates); // ⬅️ PASTIKAN INI ADA
    console.log("✅ Duplicate seat check done.");
  } catch (err) {
    console.error("❌ Error in DuplicateSeatCron:", err);
  }
});
};

// create more cron job for seat that already boosted but the availabiulity is still true

const seatBoostedJob = () => {
  const cronFrequency =
    process.env.CRON_FREQUENCY_SEAT_BOOSTED || "0 */1 * * *"; // Default to every 15 minutes if not set

  console.log(`📆 Registering SeatBoostedCron with frequency: ${cronFrequency}`);

  cron.schedule(cronFrequency, async () => {
    console.log("🕒 Running scheduled seat boosted checker...");
    try {
      const boostedSeats = await findBoostedSeats();
      console.log(`🔍 Found ${boostedSeats.length} boosted seats.`);

      console.log("📡 Sending boosted seat report to Telegram...");
      await notifyTelegramSeatBoosted(boostedSeats);
      console.log("✅ Seat boosted check done.");
    } catch (err) {
      console.error("❌ Error in SeatBoostedCron:", err);
    }
  });
};

module.exports = {
  scheduleDuplicateSeatJob,
  seatBoostedJob
};