// utils/seatCapacityCron.js
const cron = require("node-cron");
const { performSeatCapacityCheckAndEmail } = require("./seatCapacityAlert");

let isRunning = false;

const scheduleSeatCapacityCron = () => {
  // change 2 am in the morning
  const expr = process.env.SEAT_ALERT_CRON || "0 2 * * *";
  const timezone = process.env.CRON_TZ || "Asia/Jakarta";

  if (!cron.validate(expr)) {
    console.error(`❌ Invalid SEAT_ALERT_CRON="${expr}" — cron not scheduled`);
    return;
  }

  console.log(`📆 Registering SeatCapacityAlert | ${expr} | tz=${timezone}`);

  cron.schedule(
    expr,
    async () => {
      if (isRunning) {
        console.warn("⏳ SeatCapacityAlert: previous run still in progress, skip tick");
        return;
      }
      isRunning = true;
      const started = Date.now();
      console.log("🚀 SeatCapacityAlert: Starting daily capacity check (7 days ahead)");

      try {
        const result = await performSeatCapacityCheckAndEmail({
          daysAhead: Number(process.env.SEAT_ALERT_DAYS_AHEAD || 7),
          thresholdRatio: Number(process.env.SEAT_ALERT_THRESHOLD || 0.9),
        });

        console.log(
          `✅ SeatCapacityAlert done in ${Date.now() - started}ms — checked=${result.checked}, alerted=${result.alerted}`
        );
      } catch (err) {
        console.error("❌ SeatCapacityAlert failed:", err.message);
      } finally {
        isRunning = false;
      }
    },
    { timezone }
  );
};

module.exports = {
  scheduleSeatCapacityCron,
};