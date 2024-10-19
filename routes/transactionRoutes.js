// routes/transactionRoutes.js
const express = require('express');
const router = express.Router();
const { updateTransactionStatusHandler,getTransactions,updateMultiTransactionStatusHandler } = require('../controllers/transactionController');
const authenticate = require('../middleware/authenticate');


router.put('/:transaction_id/status',authenticate, updateTransactionStatusHandler);
// Route untuk memperbarui beberapa transaksi sekaligus berdasarkan array transaction_ids
router.put('/multi/status', authenticate, updateMultiTransactionStatusHandler);


router.get('/',authenticate,getTransactions );

module.exports = router;
