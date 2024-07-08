const express = require('express');
const router = express.Router();
const passengerController = require('../controllers/passengerController');

// CREATE passenger
router.post('/', passengerController.createPassenger);

// READ passengers
router.get('/', passengerController.getPassengers);

// READ passenger by id
router.get('/:id', passengerController.getPassengerById);

// UPDATE passenger
router.put('/:id', passengerController.updatePassenger);

// DELETE passenger
router.delete('/:id', passengerController.deletePassenger);

module.exports = router;
