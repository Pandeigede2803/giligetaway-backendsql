const cron = require("node-cron");
const {
  findDuplicateSeats,
  notifyTelegram,
  findBoostedSeats,
  notifyTelegramSeatBoosted,
} = require("../controllers/seatAvailabilityController");

let isDuplicateSeatJobRunning = false;
let isSeatBoostedJobRunning = false;

const runDuplicateSeatJobTask = async () => {
  if (isDuplicateSeatJobRunning) {
    console.warn("⏳ DuplicateSeatCron: previous run still in progress, skip run");
    return { skipped: true, reason: "already_running" };
  }
  isDuplicateSeatJobRunning = true;
  console.log("🕒 Running scheduled duplicate seat checker...");

  try {
    const duplicates = await findDuplicateSeats();
    await notifyTelegram(duplicates);
    console.log("✅ Duplicate seat check done.");
    return { skipped: false, duplicatesFound: duplicates.length };
  } catch (err) {
    console.error("❌ Error in DuplicateSeatCron:", err);
    throw err;
  } finally {
    isDuplicateSeatJobRunning = false;
  }
};

const runSeatBoostedJobTask = async () => {
  if (isSeatBoostedJobRunning) {
    console.warn("⏳ SeatBoostedCron: previous run still in progress, skip run");
    return { skipped: true, reason: "already_running" };
  }
  isSeatBoostedJobRunning = true;
  console.log("🕒 Running scheduled seat boosted checker...");

  try {
    const boostedSeats = await findBoostedSeats();
    console.log(`🔍 Found ${boostedSeats.length} boosted seats.`);
    await notifyTelegramSeatBoosted(boostedSeats);
    console.log("✅ Seat boosted check done.");
    return { skipped: false, boostedFound: boostedSeats.length };
  } catch (err) {
    console.error("❌ Error in SeatBoostedCron:", err);
    throw err;
  } finally {
    isSeatBoostedJobRunning = false;
  }
};

const scheduleDuplicateSeatJob = () => {
  const cronFrequency =
    process.env.CRON_FREQUENCY_SEAT_DUPLICATE || "17 * * * *"; // Default hourly at minute 17

  // console.log(`📆 Registering DuplicateSeatCron with frequency: ${cronFrequency}`);

 cron.schedule(cronFrequency, async () => {
  await runDuplicateSeatJobTask();
});
};

// create more cron job for seat that already boosted but the availabiulity is still true

const seatBoostedJob = () => {
  const cronFrequency =
    process.env.CRON_FREQUENCY_SEAT_BOOSTED || "37 * * * *"; // Default hourly at minute 37

  console.log(`📆 Registering SeatBoostedCron with frequency: ${cronFrequency}`);

  cron.schedule(cronFrequency, async () => {
    await runSeatBoostedJobTask();
  });
};

module.exports = {
  scheduleDuplicateSeatJob,
  seatBoostedJob,
  runDuplicateSeatJobTask,
  runSeatBoostedJobTask,
};
