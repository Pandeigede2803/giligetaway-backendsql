const express = require('express');
const router = express.Router();
const { findSeatAvailabilityById,getFilteredBookingsBySeatAvailability,findSeatAvailabilityByTicketId,findSeatAvailabilityByIdSimple,findRelatedPassengerBySeatAvailabilityId } = require('../controllers/bookingSeatAvailabilityController');

// Route untuk mencari seat availability berdasarkan ID
router.get('/seat-availability/:id', findSeatAvailabilityById);
router.get('/seat-availability-simple/:id', findSeatAvailabilityByIdSimple);

//route untukmencari seatavailability passenger subschedule dan mainschedule berdasarkan ID
router.get('/seat-sub-schedule/:id',getFilteredBookingsBySeatAvailability );
router.get('/seat-sub-schedule-passenger/:id',findRelatedPassengerBySeatAvailabilityId );
router.get('/booking-ticket', findSeatAvailabilityByTicketId);

module.exports = router;
