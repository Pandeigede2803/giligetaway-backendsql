// utils/seatFixCron.js
const cron = require('node-cron');
const { fixAllSeatMismatches } = require('../controllers/seatAvailabilityController');

const scheduleSeatFixJob = () => {
  const cronFrequency = process.env.CRON_FREQUENCY_SEAT_MISMATCH || '0 */3 * * *'; // default 3 jam
  console.log(`📆 Registering SeatFixCron with frequency: ${cronFrequency}`);

  cron.schedule(cronFrequency, async () => {
    console.log("🚀 SeatFixCron: Starting seat mismatch correction job...");
    await fixAllSeatMismatches();
  });
};

module.exports = {
  scheduleSeatFixJob
};
