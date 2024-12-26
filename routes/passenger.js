const express = require('express');
const router = express.Router();
const passengerController = require('../controllers/passengerController');
const authenticate = require('../middleware/authenticate');
const {validatePassengerCriteria,validateDaysOfWeekForDate} = require('../middleware/passengerValidation'); // Import middleware




// CREATE passenger
router.post('/', authenticate, passengerController.createPassenger);

// READ passengers
router.get('/', authenticate, passengerController.getPassengers);

// READ passengers count by date
router.get('/coun-by-date', authenticate, passengerController.getPassengerCountByDate);
// READ passengers count by date
router.get('/seat-number', authenticate,validatePassengerCriteria, passengerController.getPassengersSeatNumber);

// READ passengers count by date
router.get('/count-by-month', authenticate, passengerController.getPassengerCountByMonth);
router.get('/count-by-schedule', authenticate, passengerController.getPassengerCountBySchedule);

// READ passengers by schedule and subschedule
router.get('/by', authenticate, passengerController.getPassengersByScheduleAndSubSchedule);


// READ passenger by id
router.get('/:id', authenticate, passengerController.getPassengerById);

// UPDATE passenger
router.put('/:id', authenticate, passengerController.updatePassenger);

// DELETE passenger
router.delete('/:id', authenticate, passengerController.deletePassenger);

module.exports = router;
