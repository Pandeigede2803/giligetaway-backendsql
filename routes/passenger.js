const express = require('express');
const router = express.Router();
const passengerController = require('../controllers/passengerController');
const authenticate = require('../middleware/authenticate');


// CREATE passenger
router.post('/', authenticate, passengerController.createPassenger);

// READ passengers
router.get('/', authenticate, passengerController.getPassengers);

// READ passengers by schedule and subschedule
router.get('/by', authenticate, passengerController.getPassengersByScheduleAndSubSchedule);


// READ passenger by id
router.get('/:id', authenticate, passengerController.getPassengerById);

// UPDATE passenger
router.put('/:id', authenticate, passengerController.updatePassenger);

// DELETE passenger
router.delete('/:id', authenticate, passengerController.deletePassenger);

module.exports = router;
