// routes/destination.js
const express = require('express');
const router = express.Router();
const destinationController = require('../controllers/destinationController');
const authenticate = require('../middleware/authenticate');

// CREATE single destination
router.post('/', authenticate, destinationController.createDestination);

// CREATE multiple destinations
router.post('/bulk', authenticate, destinationController.createMultipleDestinations);

// READ all destinations
router.get('/', authenticate, destinationController.getDestinations);

// READ destination by id
router.get('/:id', authenticate, destinationController.getDestinationById);

// UPDATE destination
router.put('/:id', authenticate, destinationController.updateDestination);

// DELETE destination
router.delete('/:id', authenticate, destinationController.deleteDestination);

module.exports = router;
