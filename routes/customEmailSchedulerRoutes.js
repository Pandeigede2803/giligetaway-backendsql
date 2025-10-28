const express = require('express');
const router = express.Router();

const customEmailScheduler = require('../controllers/customEmailSchedulerController');

const {
  validateSchedulerInput,
  validateScheduleExistence,
  validateSubScheduleExistence,
  validateBookingExistence,
} = require('../middleware/customEmailValidation');

// ==========================
// 📬 CUSTOM EMAIL SCHEDULER
// ==========================

// Get all schedulers
router.get('/', customEmailScheduler.getAllSchedulers);

// Get scheduler by ID
router.get('/:id', customEmailScheduler.getSchedulerById);

// Create new scheduler
router.post(
  '/',
  validateSchedulerInput,
  validateScheduleExistence,
  validateSubScheduleExistence,
  customEmailScheduler.createScheduler
);

// Update scheduler
router.put(
  '/:id',
  validateSchedulerInput,
  validateScheduleExistence,
  validateSubScheduleExistence,
  customEmailScheduler.updateScheduler
);

// Delete scheduler
router.delete('/:id', customEmailScheduler.deleteScheduler);

// Manual trigger for cron job (for testing)
router.post('/trigger-job', customEmailScheduler.triggerCustomEmailJob);

// ==========================
// 🧪 TEST EMAIL ENDPOINT
// ==========================

// Send a test email (input recipient manually)
router.post(
  '/test',
  validateBookingExistence,
  customEmailScheduler.sendTestEmail
);

module.exports = router;