const express = require('express');
const router = express.Router();
const { checkAvailableSeats,updateSeatAvailability, checkAllAvailableSeats, checkAllAvailableSeatsBookingCount } = require('../controllers/seatAvailabilityController'); // Adjust the path as needed
const authenticate = require('../middleware/authenticate');
// Route to check available seats for a specific schedule and date
router.get('/check-available',authenticate, checkAvailableSeats);

// Route to check all available seats for a specific schedule and date
router.get('/check-all',authenticate, checkAllAvailableSeats);

// updateseatavailability

// router.put('/update-seat',authenticate, updateSeatAvailability)
router.get('/check-all/booking-count',authenticate, checkAllAvailableSeatsBookingCount);

module.exports = router;
