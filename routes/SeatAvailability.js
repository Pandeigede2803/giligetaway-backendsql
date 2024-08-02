const express = require('express');
const router = express.Router();
const { checkAvailableSeats, checkAllAvailableSeats, checkAllAvailableSeatsBookingCount } = require('../controllers/seatAvailabilityController'); // Adjust the path as needed

// Route to check available seats for a specific schedule and date
router.get('/check-available', checkAvailableSeats);

// Route to check all available seats for a specific schedule and date
router.get('/check-all', checkAllAvailableSeats);

router.get('/check-all/booking-count', checkAllAvailableSeatsBookingCount);

module.exports = router;
