const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');
const seatAvailabilityController = require('../controllers/seatAvailabilityController');
const authenticate = require('../middleware/authenticate');
const bookingRateLimiter = require('../middleware/rateLimiter'); // Rate limiting middleware

// CREATE booking
router.post('/', bookingController.createBooking);

// Route for booking with transit
router.post('/transit', bookingController.createBookingWithTransit);

// Route for booking with transit
router.post('/transit-queue',authenticate,bookingRateLimiter, bookingController.createBookingWithTransitQueue);

// Route for booking without transit
router.post('/non-transit', bookingController.createBookingWithoutTransit);

//ROUTE FOR BOOKING WITH PAGINATION AND MONTHLY PARAMS 
router.get('/pagination',authenticate, bookingController.getPaginatedBookings);


// READ bookings
router.get('/',authenticate, bookingController.getBookings);

// READ bookings
router.get('/date',authenticate, bookingController.getBookingsByDate);

// READ booking by id
router.get('/:id', bookingController.getBookingById);

//read booking by ticket id
router.get('/ticket/:ticket_id', bookingController.getBookingByTicketId);

// UPDATE booking
router.put('/:id', bookingController.updateBooking);

//update booking payment
router.put('/payment/:id',authenticate, bookingController.updateBookingPayment);

//update booking date
router.put('/date/:id',authenticate, bookingController.updateBookingDate);

// DELETE booking
router.delete('/:id', bookingController.deleteBooking);

// Check available seats
router.get('/check-available-seats',authenticate, seatAvailabilityController.checkAvailableSeats);

// Check all contact details from booking
router.get('/contact/details', authenticate, bookingController.getBookingContact);


// // Route for booking with transit
// router.post('/createBookingWithTransit', createBookingWithTransit);

// // Route for booking without transit
// router.post('/createBookingWithoutTransit', createBookingWithoutTransit);

module.exports = router;
