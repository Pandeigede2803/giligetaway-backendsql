// routes/schedule.js
const express = require('express');
const router = express.Router();
const scheduleController = require('../controllers/scheduleController');

const validateApiKey = require('../middleware/validateKey');
const { upload,uploadImageToImageKit } = require('../middleware/upload');
const transitController = require('../controllers/transitController');
const cors = require('cors');
const bookingAgentController = require('../controllers/bookingAgentController')
const validateAgentBooking = require("../middleware/validateAgentBooking");
const validateAgentRoundTripBooking = require("../middleware/validateAgentRoundTripBooking");


const transportController = require('../controllers/transportController');

// CREATE transport

// api for search the schedule
router.get('/search-schedule/v3', validateApiKey, (req, res, next) => {
  // console.log('=== V3 Search Debug ===');
  // console.log('Query params:', req.query);
  // console.log('Headers:', req.headers);
  next();
}, scheduleController.searchSchedulesAndSubSchedulesAgent);;

// get all transport
router.get('/search-transports/v3',validateApiKey,transportController.getTransports);

// post the booking



router.post('/book/v1', validateApiKey, validateAgentBooking, bookingAgentController.createAgentBooking);
router.post('/round-trip-book/v1', validateApiKey, validateAgentRoundTripBooking, bookingAgentController.createAgentRoundTripBooking);

module.exports = router;;