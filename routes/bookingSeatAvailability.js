const express = require('express');
const router = express.Router();
const { findSeatAvailabilityById,getFilteredBookingsBySeatAvailability } = require('../controllers/bookingSeatAvailabilityController');

// Route untuk mencari seat availability berdasarkan ID
router.get('/seat-availability/:id', findSeatAvailabilityById);

//route untukmencari seatavailability passenger subschedule dan mainschedule berdasarkan ID
router.get('/seat-sub-schedule/:id',getFilteredBookingsBySeatAvailability );


module.exports = router;
