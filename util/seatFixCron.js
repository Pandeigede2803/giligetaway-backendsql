// utils/seatFixCron.js
const cron = require('node-cron');
const { fixAllSeatMismatches3 } = require('../controllers/seatAvailabilityController');

let isSeatFixRunning = false;

const scheduleSeatFixJob = () => {
  const cronFrequency = process.env.CRON_FREQUENCY_SEAT_MISMATCH || '*/5 * * * *'; // default 5 menit
  // console.log(`📆 Registering SeatFixCron with frequency: ${cronFrequency}`);

  cron.schedule(cronFrequency, async () => {
    if (isSeatFixRunning) {
      console.warn("⏳ SeatFixCron: previous run still in progress, skip tick");
      return;
    }
    isSeatFixRunning = true;
    console.log("🚀 SeatFixCron: Starting seat mismatch correction job...");
    try {
      await fixAllSeatMismatches3({ mode: "regular" });
    } finally {
      isSeatFixRunning = false;
    }
  });
};

const scheduleSeatFixDeepScanJob = () => {
  const cronFrequency =
    process.env.CRON_FREQUENCY_SEAT_MISMATCH_DEEP || "30 2 * * *"; // default daily 02:30

  cron.schedule(cronFrequency, async () => {
    if (isSeatFixRunning) {
      console.warn("⏳ SeatFixDeepCron: regular/deep job still in progress, skip tick");
      return;
    }
    isSeatFixRunning = true;
    console.log("🧪 SeatFixDeepCron: Starting deep scan seat mismatch job...");
    try {
      await fixAllSeatMismatches3({
        mode: "deep-daily",
        maxBatchesPerRun: 0,
        batchDelayMs: Number(process.env.SEAT_FIX_DEEP_BATCH_DELAY_MS || 100),
        batchSize: Number(process.env.SEAT_FIX_DEEP_BATCH_SIZE || 200),
        lookbackDays: Number(process.env.SEAT_FIX_DEEP_LOOKBACK_DAYS || 3650),
        lookaheadDays:
          process.env.SEAT_FIX_DEEP_LOOKAHEAD_DAYS === ""
            ? null
            : process.env.SEAT_FIX_DEEP_LOOKAHEAD_DAYS
              ? Number(process.env.SEAT_FIX_DEEP_LOOKAHEAD_DAYS)
              : null,
        sendProgressTelegram:
          String(process.env.SEAT_FIX_DEEP_TELEGRAM_PROGRESS || "false").toLowerCase() ===
          "true",
        progressEveryBatches: Number(
          process.env.SEAT_FIX_DEEP_TELEGRAM_EVERY_BATCHES || 25
        ),
      });
    } finally {
      isSeatFixRunning = false;
    }
  });
};

module.exports = {
  scheduleSeatFixJob,
  scheduleSeatFixDeepScanJob,
};
