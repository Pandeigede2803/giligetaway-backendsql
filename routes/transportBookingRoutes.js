const express = require('express');
const router = express.Router();
const transportBookingController = require('../controllers/transportBookingController');
const authenticate = require('../middleware/authenticate');

// Get all transport bookings
router.get('/',authenticate, transportBookingController.getAllTransportBookings);

router.get('/review',authenticate, transportBookingController.getAllTransportBookingsReview);

// Create new transport booking
router.post('/',authenticate, transportBookingController.addTransportBooking);

// Update transport booking
router.put('/:id',authenticate, transportBookingController.updateTransportBooking);

// Delete transport booking
router.delete('/:id',authenticate,  transportBookingController.deleteTransportBooking);

module.exports = router;
