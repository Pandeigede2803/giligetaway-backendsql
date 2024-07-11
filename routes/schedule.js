// routes/schedule.js
const express = require('express');
const router = express.Router();
const scheduleController = require('../controllers/scheduleController');
const authenticate = require('../middleware/authenticate');
const { upload,uploadImageToImageKit } = require('../middleware/upload');
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
router.put('/:id', authenticate, scheduleController.updateSchedule);

// DELETE schedule
router.delete('/:id', authenticate, scheduleController.deleteSchedule);



module.exports = router;


// // UPLOAD multiple schedules via CSV
// router.post('/upload', authenticate, upload.single('file'), scheduleController.uploadSchedules);


// const express = require('express');
// const router = express.Router();
// const { createScheduleWithTransit, getAllSchedulesWithDetails, getSchedules, getScheduleById, getSchedulesByDestination, getSchedulesByValidity, getSchedulesByBoat, getSchedulesByUser, updateSchedule, deleteSchedule, uploadSchedules } = require('../controllers/scheduleController');

// router.post('/api/schedules', createScheduleWithTransit);
// router.get('/api/schedules', getSchedules);
// router.get('/api/schedules/:id', getScheduleById);
// router.get('/api/schedules/destination/:destinationId', getSchedulesByDestination);
// router.get('/api/schedules/validity/:validity', getSchedulesByValidity);
// router.get('/api/schedules/boat/:boatId', getSchedulesByBoat);
// router.get('/api/schedules/user/:userId', getSchedulesByUser);
// router.put('/api/schedules/:id', updateSchedule);
// router.delete('/api/schedules/:id', deleteSchedule);
// router.post('/api/schedules/upload', uploadSchedules);


// module.exports = router;
