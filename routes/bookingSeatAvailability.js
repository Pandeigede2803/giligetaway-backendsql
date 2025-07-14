const express = require('express');
const router = express.Router();
const validateSeatRelation = require('../middleware/seatRelation');
const { findSeatAvailabilityById,getFilteredBookingsBySeatAvailability,findMissingRelatedByTicketId,createBookingSeatAvailabilityBatch,findSeatAvailabilityByTicketId,findSeatAvailabilityByIdSimple,findRelatedPassengerBySeatAvailabilityId } = require('../controllers/bookingSeatAvailabilityController');

// Route untuk mencari seat availability berdasarkan ID
router.get('/seat-availability/:id', findSeatAvailabilityById);
router.get('/seat-availability-simple/:id', findSeatAvailabilityByIdSimple);

//route untukmencari seatavailability passenger subschedule dan mainschedule berdasarkan ID
router.get('/seat-sub-schedule/:id',getFilteredBookingsBySeatAvailability );
router.get('/seat-sub-schedule-passenger/:id',findRelatedPassengerBySeatAvailabilityId );
router.get('/booking-ticket',validateSeatRelation, findSeatAvailabilityByTicketId);
router.post('/booking-seat-availability/batch', createBookingSeatAvailabilityBatch);
// GET /seat/missing-related-by-ticket
router.get('/missing-related-by-ticket', findMissingRelatedByTicketId);

module.exports = router;
