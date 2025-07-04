// routes/schedule.js
const express = require('express');
const router = express.Router();
const scheduleController = require('../controllers/scheduleController');
const authenticate = require('../middleware/authenticate');
const validateApiKey = require('../middleware/validateKey');
const { upload,uploadImageToImageKit } = require('../middleware/upload');
const transitController = require('../controllers/transitController');
const cors = require('cors');


// api for search the schedule
router.get('/search-schedule/v3', validateApiKey, (req, res, next) => {
  console.log('=== V3 Search Debug ===');
  console.log('Query params:', req.query);
  console.log('Headers:', req.headers);
  next();
}, scheduleController.searchSchedulesAndSubSchedulesAgent);

module.exports = router;