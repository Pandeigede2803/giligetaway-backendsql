// routes/transactionRoutes.js
const express = require('express');
const router = express.Router();
const { updateTransactionStatusHandler,getTransactions } = require('../controllers/transactionController');
const authenticate = require('../middleware/authenticate');


router.put('/:transaction_id/status',authenticate, updateTransactionStatusHandler);

router.get('/',authenticate,getTransactions );

module.exports = router;
