const express = require('express');
const router = express.Router();
const { findSeatAvailabilityById } = require('../controllers/boatSeatAvailabilityController');

// Route untuk mencari seat availability berdasarkan ID
router.get('/seat-availability/:id', findSeatAvailabilityById);

module.exports = router;
