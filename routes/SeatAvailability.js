const express = require('express');
const router = express.Router();
const {getAllSeatAvailabilityScheduleAndSubSchedule, checkAvailableSeats,updateSeatAvailability, checkAllAvailableSeats,getFilteredSeatAvailabilityById, checkAllAvailableSeatsBookingCount } = require('../controllers/seatAvailabilityController'); // Adjust the path as needed
const authenticate = require('../middleware/authenticate');
// Route to check available seats for a specific schedule and date
router.get('/check-available',authenticate, checkAvailableSeats);

// Route to check all available seats for a specific schedule and date
router.get('/check-all',authenticate, checkAllAvailableSeats);

// updateseatavailability

router.put('/update-seat/:id',authenticate, updateSeatAvailability);

router.get('/related-seat/:id',authenticate,getFilteredSeatAvailabilityById );



// Route to check all available seats for a specific schedule and date
router.get('/check-all/booking-count',authenticate, checkAllAvailableSeatsBookingCount);

// updateseatavailability

router.get("/get-all-seat-availability-schedule-and-subschedule",authenticate,getAllSeatAvailabilityScheduleAndSubSchedule );

module.exports = router;
