// routes/schedule.js
const express = require('express');
const router = express.Router();
const scheduleController = require('../controllers/scheduleController');
const authenticate = require('../middleware/authenticate');
const upload = require('../middleware/upload');

// CREATE schedule
router.post('/', authenticate, scheduleController.createSchedule);

// UPLOAD multiple schedules via CSV
router.post('/upload', authenticate, upload.single('file'), scheduleController.uploadSchedules);

// READ schedules
router.get('/', authenticate, scheduleController.getSchedules);

// READ schedule by id
router.get('/:id', authenticate, scheduleController.getScheduleById);

// UPDATE schedule
router.put('/:id', authenticate, scheduleController.updateSchedule);

// DELETE schedule
router.delete('/:id', authenticate, scheduleController.deleteSchedule);

module.exports = router;