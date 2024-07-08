// routes/transit.js
const express = require('express');
const router = express.Router();
const transitController = require('../controllers/transitController');
const authenticate = require('../middleware/authenticate');

// CREATE transit
router.post('/', authenticate, transitController.createTransit);

// get all transit
router.get('/', authenticate, transitController.getAllTransits);

// READ transits by schedule
router.get('/schedule/:scheduleId', authenticate, transitController.getTransitsBySchedule);

// READ transit by id
router.get('/:id', authenticate, transitController.getTransitById);

// UPDATE transit
router.put('/:id', authenticate, transitController.updateTransit);

// DELETE transit
router.delete('/:id', authenticate, transitController.deleteTransit);

module.exports = router;
