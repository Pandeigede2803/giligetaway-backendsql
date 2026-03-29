// utils/seatFixCron.js
const cron = require('node-cron');
const { fixAllSeatMismatches3 } = require('../controllers/seatAvailabilityController');

const scheduleSeatFixJob = () => {
  const cronFrequency = process.env.CRON_FREQUENCY_SEAT_MISMATCH || '*/7 * * * *'; // default 4 jam
  // console.log(`📆 Registering SeatFixCron with frequency: ${cronFrequency}`);

  cron.schedule(cronFrequency, async () => {
    console.log("🚀 SeatFixCron: Starting seat mismatch correction job...");
    await fixAllSeatMismatches3();
  });
};

module.exports = {
  scheduleSeatFixJob
};
