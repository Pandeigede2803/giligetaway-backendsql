// routes/transactionRoutes.js
const express = require('express');
const router = express.Router();
const { updateTransactionStatusHandler } = require('../controllers/transactionController');

router.put('/:transaction_id/status', updateTransactionStatusHandler);

module.exports = router;
