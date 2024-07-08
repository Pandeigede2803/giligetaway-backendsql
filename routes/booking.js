const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');
const seatAvailabilityController = require('../controllers/seatAvailabilityController');

// CREATE booking
router.post('/', bookingController.createBooking);

// Route for booking with transit
router.post('/createBookingWithTransit', bookingController.createBookingWithTransit);

// Route for booking without transit
router.post('/createBookingWithoutTransit', bookingController.createBookingWithoutTransit);


// READ bookings
router.get('/', bookingController.getBookings);

// READ booking by id
router.get('/:id', bookingController.getBookingById);

// UPDATE booking
router.put('/:id', bookingController.updateBooking);

// DELETE booking
router.delete('/:id', bookingController.deleteBooking);

// Check available seats
router.get('/check-available-seats', seatAvailabilityController.checkAvailableSeats);


// // Route for booking with transit
// router.post('/createBookingWithTransit', createBookingWithTransit);

// // Route for booking without transit
// router.post('/createBookingWithoutTransit', createBookingWithoutTransit);

module.exports = router;
