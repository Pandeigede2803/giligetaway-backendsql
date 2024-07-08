const express = require('express');
const router = express.Router();
const transportController = require('../controllers/transportController');
const authenticate = require('../middleware/authenticate');
// CREATE transport
router.post('/', authenticate, transportController.createTransport);

// READ transports
router.get('/', authenticate, transportController.getTransports);

// READ transport by id
router.get('/:id', authenticate, transportController.getTransportById);

// UPDATE transport
router.put('/:id', authenticate, transportController.updateTransport);

// DELETE transport
router.delete('/:id', authenticate, transportController.deleteTransport);


// CREATE multiple transports
router.post('/bulk',authenticate, transportController.createMultipleTransports);

module.exports = router;
