const express = require('express');
const router = express.Router();
const passengerController = require('../controllers/passengerController');
const authenticate = require('../middleware/authenticate');
const {validatePassengerCriteria,validateDaysOfWeekForDate} = require('../middleware/passengerValidation'); // Import middleware




// // CREATE passenger
router.post('/', authenticate, passengerController.createPassenger);

// add passenger
router.post('/booking/:booking_id', authenticate, passengerController.addPassenger);


// READ passengers
router.get('/', authenticate, passengerController.getPassengers);

// READ passengers count by date
router.get('/coun-by-date', authenticate, passengerController.getPassengerCountByDate);
// READ passengers count by date
router.get('/seat-number', authenticate,validatePassengerCriteria, passengerController.getPassengersSeatNumber);

// ✅ GET seat number by booking_id
router.get('/seat-number/by-booking', authenticate, passengerController.getPassengersSeatNumberByBookingId);

// READ passengers count by date
router.get('/count-by-month', authenticate, passengerController.getPassengerCountByMonth);

router.get('/count-by-schedule', authenticate, passengerController.getPassengerCountBySchedule);


router.get('/count-by-schedule-and-booking-date', authenticate, passengerController.getPassengerCountByBookingDateAndSchedule);
// READ passengers by schedule and subschedule
router.get('/by', authenticate, passengerController.getPassengersByScheduleAndSubSchedule);


// READ passenger by id
router.get('/:id', authenticate, passengerController.getPassengerById);

// UPDATE passenger
router.put('/:id', authenticate, passengerController.updatePassenger);

// DELETE passenger
router.delete('/:id', authenticate, passengerController.deletePassenger);

// DELETE passenger booking id
router.delete('/booking/:booking_id', authenticate, passengerController.deletePassenger);


module.exports = router;
