const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');
const seatAvailabilityController = require('../controllers/seatAvailabilityController');
const authenticate = require('../middleware/authenticate');
const bookingRateLimiter = require('../middleware/rateLimiter'); // Rate limiting middleware
const {validateScheduleAndSubSchedule,validateScheduleAndSubScheduleForRoundTrip} = require('../middleware/validateScheduleAndSubschedule');
const validateTrips = require('../middleware/validateTrips');
const { checkSeatAvailabilityForUpdate,checkSeatAvailabilityForUpdate2,
    validateBookingDate,
    validateRoundTripTicket,validateBookingDate2,checkBookingDateUpdate,validatePaymentUpdate,checkAgentPassword, 
    checkBookingDateUpdate2,checkBookingDateUpdateDirect} = require('../middleware/checkSeatAvailabilityForUpdate');
const { validateBookingCreation ,  validateTransportData,validateMultipleBookingCreation,validateRoundTripBookingPost} = require('../middleware/validateBookingcreation');
const bulkBookingController = require('../controllers/bulkBookingController');
const multer = require('multer');
const path = require('path');

// Setup multer untuk upload file



// CREATE booking
router.post('/', bookingController.createBooking);

// Route for booking with transit
router.post('/transit', bookingController.createBookingWithTransit);

// Route for booking with transit

router.post('/transit-queue',authenticate,validateScheduleAndSubSchedule,validateBookingCreation,validateTransportData,bookingController.createBookingWithTransitQueue);


// Route for booking with transit multiple
router.post('/multi-queue',authenticate,bookingRateLimiter, validateMultipleBookingCreation,validateTrips, bookingController.createBookingMultiple);
// Route for booking with transit multiple
router.post('/round-queue',authenticate,bookingRateLimiter,validateScheduleAndSubScheduleForRoundTrip, validateRoundTripBookingPost, bookingController.createRoundBookingWithTransitQueue);



// Route for booking without transit
router.post('/non-transit', bookingController.createBookingWithoutTransit);

router.post('/find-related-sub-schedules', bookingController.findRelatedSubSchedulesGet);;


//ROUTE FOR BOOKING WITH PAGINATION AND MONTHLY PARAMS 
router.get('/filtered',authenticate, bookingController.getFilteredBookings);;


// READ bookings
router.get('/',authenticate, bookingController.getBookings);

// get abandoned payment
router.get('/abandoned-payments',authenticate, bookingController.getAbandonedPayments);

router.get('abandoned-payments/:id',authenticate, bookingController.getAbandonedPaymentById);



// READ bookings
router.get('/date',authenticate, bookingController.getBookingsByDate);;

// READ booking by id
router.get('/:id', bookingController.getBookingById);;

//read booking by ticket id
router.get('/ticket/:ticket_id',bookingController.getBookingByTicketId);

//read booking by ticket id
router.get('/ticket-related/:ticket_id',
    validateRoundTripTicket
    ,
    bookingController.getRelatedBookingsByTicketId);

//update multiple booking payment
router.put('/multipayment',authenticate, bookingController.updateMultipleBookingPayment);

// UPDATE booking
router.put('/:id', bookingController.updateBooking);


// update Booking note
router.put('/note/:id',authenticate, bookingController.updateBookingNotes);

//upd
//update booking payment
router.put('/payment/:id',authenticate,validatePaymentUpdate, bookingController.updateBookingPayment);


router.put('/date/:id',authenticate,validateBookingDate,checkSeatAvailabilityForUpdate,checkBookingDateUpdateDirect, bookingController.updateBookingDate);

router.put('/date-agent/:booking_id',authenticate,checkBookingDateUpdate,validateBookingDate2,checkSeatAvailabilityForUpdate2, bookingController.updateBookingDateAgent);

// cancen booking
router.put('/:booking_id/cancel',authenticate,checkBookingDateUpdate2, bookingController.cancelBooking);

// DELETE booking
router.delete('/:id',authenticate, bookingController.deleteBooking);

// Check available seats
router.get('/check-available-seats',authenticate, seatAvailabilityController.checkAvailableSeats);

// Check all contact details from booking
router.get('/contact/details', authenticate, bookingController.getBookingContact);


// // Route for booking with transit
// router.post('/createBookingWithTransit', createBookingWithTransit);

// // Route for booking without transit
// router.post('/createBookingWithoutTransit', createBookingWithoutTransit);




// BULK BOOKING

router.post('/bulk-multi-csv', (req, res, next) => {
    bulkBookingController.bulkBookingFromMultiCSV(req, res, next);
  });

  // Route untuk bulk booking dengan CSV

  // Route untuk mendapatkan history bulk booking
  router.get(
    '/bulk-booking/history',
    authenticate,
    bulkBookingController.getBulkBookingHistory
  );
  
  // Route untuk mendapatkan detail bulk booking
  router.get(
    '/bulk-details/:id',
    authenticate,
    bulkBookingController.getBulkBookingDetails
  );
  
  // Routes untuk mendapatkan template CSV
  router.get(
    '/templates/bookings',
    authenticate,
    bulkBookingController.getBookingsTemplate
  );
  
  router.get(
    '/templates/passengers',
    authenticate,
    bulkBookingController.getPassengersTemplate
  );
  
  router.get(
    '/templates/transports',
    authenticate,
    bulkBookingController.getTransportsTemplate
  );
  
  // Route untuk memeriksa status bulk booking


module.exports = router;
