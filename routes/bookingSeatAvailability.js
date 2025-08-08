const express = require('express');
const router = express.Router();
const validateSeatRelation = require('../middleware/seatRelation');
const { findSeatAvailabilityById,getFilteredBookingsBySeatAvailability,findMissingRelatedByTicketId,createBookingSeatAvailabilityBatch,findSeatAvailabilityByTicketId,findSeatAvailabilityByIdSimple,findRelatedPassengerBySeatAvailabilityId, deleteBookingSeat } = require('../controllers/bookingSeatAvailabilityController');

const {testTelegram} = require('../controllers/telegramController');



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

router.get('/test-telegram', testTelegram);


// Route to delete a booking seat availability by ID
router.delete('/booking-seat-availability/:id', deleteBookingSeat);



module.exports = router;
