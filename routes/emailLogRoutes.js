const express = require('express');
const router = express.Router();
const controller = require('../controllers/emailSendLogController');

// Get all logs
router.get('/', controller.getAllLogs);

// Get a single log by ID
router.get('/:id', controller.getLogById);

// Create log manually (for testing)
router.post('/', controller.createLog);

// Delete a specific log
router.delete('/:id', controller.deleteLog);

// Clear all logs (admin only — be careful)
router.delete('/', controller.clearAllLogs);

module.exports = router;