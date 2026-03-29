const cron = require("node-cron");
const { runCustomEmailJobTask } = require("./customEmailJob");
const {
  runDuplicateSeatJobTask,
  runSeatBoostedJobTask,
} = require("./cronFrequencySeatDuplicates");

let isPromoChainRunning = false;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const isEnabled = (value, defaultValue = false) => {
  if (value === undefined || value === null || value === "") return defaultValue;
  return String(value).toLowerCase() === "true";
};

const runPromoOpsChainTask = async () => {
  if (isPromoChainRunning) {
    console.warn("⏳ PromoOpsChainCron: previous run still in progress, skip run");
    return { skipped: true, reason: "already_running" };
  }

  isPromoChainRunning = true;
  const started = Date.now();
  const stepDelayMs = Number(process.env.PROMO_CHAIN_STEP_DELAY_MS || 3000);
  const duplicateToBoostedDelayMs = Number(
    process.env.PROMO_CHAIN_DUPLICATE_TO_BOOSTED_DELAY_MS || 900000
  ); // default 15 menit
  const runCustomEmail = isEnabled(process.env.PROMO_CHAIN_RUN_CUSTOM_EMAIL, true);
  const runDuplicateSeat = isEnabled(process.env.PROMO_CHAIN_RUN_DUPLICATE, true);
  const runSeatBoosted = isEnabled(process.env.PROMO_CHAIN_RUN_BOOSTED, true);
  console.log("🧵 PromoOpsChainCron started (custom-email -> duplicate-seat -> seat-boosted)");

  try {
    const customEmailResult = runCustomEmail
      ? await runCustomEmailJobTask()
      : { skipped: true, reason: "disabled_by_env" };

    if (runDuplicateSeat) {
      await sleep(stepDelayMs);
    }

    const duplicateResult = runDuplicateSeat
      ? await runDuplicateSeatJobTask()
      : { skipped: true, reason: "disabled_by_env" };

    if (runSeatBoosted) {
      await sleep(duplicateToBoostedDelayMs);
    }

    const boostedResult = runSeatBoosted
      ? await runSeatBoostedJobTask()
      : { skipped: true, reason: "disabled_by_env" };

    const durationMs = Date.now() - started;
    console.log(`✅ PromoOpsChainCron done in ${durationMs}ms`);

    return {
      skipped: false,
      durationMs,
      customEmailResult,
      duplicateResult,
      boostedResult,
    };
  } catch (error) {
    console.error("❌ PromoOpsChainCron failed:", error.message);
    throw error;
  } finally {
    isPromoChainRunning = false;
  }
};

const schedulePromoOpsChainCron = () => {
  const cronFrequency = process.env.CRON_FREQUENCY_PROMO_CHAIN || "11 */5 * * *";
  console.log(`📆 Registering PromoOpsChainCron with frequency: ${cronFrequency}`);

  cron.schedule(cronFrequency, async () => {
    await runPromoOpsChainTask();
  });
};

module.exports = {
  schedulePromoOpsChainCron,
  runPromoOpsChainTask,
};
