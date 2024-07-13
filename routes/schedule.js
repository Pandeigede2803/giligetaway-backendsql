// routes/schedule.js
const express = require('express');
const router = express.Router();
const scheduleController = require('../controllers/scheduleController');
const authenticate = require('../middleware/authenticate');
const { upload,uploadImageToImageKit } = require('../middleware/upload');
const transitController = require('../controllers/transitController');

// const upload = require('../middleware/upload');

// CREATE schedule
/// CREATE schedule with transits
router.post('/withtransits', authenticate, upload, scheduleController.createScheduleWithTransit);


router.get('/all-details',authenticate, scheduleController.getAllSchedulesWithDetails);

// READ schedules
router.get('/', authenticate, scheduleController.getSchedules);

// READ schedule by id
router.get('/:id', authenticate, scheduleController.getScheduleById);

// UPDATE schedule
router.put('/:id', authenticate, upload, scheduleController.updateSchedule);

router.put('/:scheduleId/transits',authenticate, transitController.updateTransit);

// DELETE schedule
router.delete('/:id', authenticate, scheduleController.deleteSchedule);



module.exports = router;



