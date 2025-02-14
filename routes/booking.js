const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');
const seatAvailabilityController = require('../controllers/seatAvailabilityController');
const authenticate = require('../middleware/authenticate');
const bookingRateLimiter = require('../middleware/rateLimiter'); // Rate limiting middleware
const {validateScheduleAndSubSchedule,validateScheduleAndSubScheduleForRoundTrip} = require('../middleware/validateScheduleAndSubschedule');
const validateTrips = require('../middleware/validateTrips');
const { checkSeatAvailabilityForUpdate,checkSeatAvailabilityForUpdate2,
    validateBookingDate,validateBookingDate2,checkBookingDateUpdate,validatePaymentUpdate,checkAgentPassword, 
    checkBookingDateUpdate2} = require('../middleware/checkSeatAvailabilityForUpdate');
const { validateBookingCreation ,validateMultipleBookingCreation,validateRoundTripBookingPost} = require('../middleware/validateBookingcreation');

// CREATE booking
router.post('/', bookingController.createBooking);

// Route for booking with transit
router.post('/transit', bookingController.createBookingWithTransit);

// Route for booking with transit
router.post('/transit-queue',authenticate,validateScheduleAndSubSchedule,validateBookingCreation, bookingController.createBookingWithTransitQueue);


// Route for booking with transit multiple
router.post('/multi-queue',authenticate,bookingRateLimiter, validateMultipleBookingCreation,validateTrips, bookingController.createBookingMultiple);
// Route for booking with transit multiple
router.post('/round-queue',authenticate,bookingRateLimiter,validateScheduleAndSubScheduleForRoundTrip, validateRoundTripBookingPost, bookingController.createRoundBookingWithTransitQueue);


// Route for booking without transit
router.post('/non-transit', bookingController.createBookingWithoutTransit);

//ROUTE FOR BOOKING WITH PAGINATION AND MONTHLY PARAMS 
router.get('/filtered',authenticate, bookingController.getFilteredBookings);;


// READ bookings
router.get('/',authenticate, bookingController.getBookings);

// READ bookings
router.get('/date',authenticate, bookingController.getBookingsByDate);;

// READ booking by id
router.get('/:id', bookingController.getBookingById);;

//read booking by ticket id
router.get('/ticket/:ticket_id', bookingController.getBookingByTicketId);

// UPDATE booking
router.put('/:id', bookingController.updateBooking);

//update booking payment
router.put('/payment/:id',authenticate,validatePaymentUpdate, bookingController.updateBookingPayment);

//update booking date
router.put('/date/:id',authenticate,validateBookingDate,checkSeatAvailabilityForUpdate, bookingController.updateBookingDate);

router.put('/date-agent/:booking_id',authenticate,checkBookingDateUpdate,validateBookingDate2,checkSeatAvailabilityForUpdate2, bookingController.updateBookingDateAgent);

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

module.exports = router;
