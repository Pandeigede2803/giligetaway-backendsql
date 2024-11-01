// routes/transactionRoutes.js
const express = require('express');
const router = express.Router();
const { updateTransactionStatusHandler,getTransactions, updateMultiTransactionStatusHandler,updateAgentTransactionStatusHandler } = require('../controllers/transactionController');
const authenticate = require('../middleware/authenticate');
const transactionUpdateValidation = require('../validation/transcationUpdateValidation');
const calculateAgentCommissionMiddleware = require('../middleware/calculateAgentComissionMiddleware');


router.put('/:transaction_id/status',authenticate, updateTransactionStatusHandler);

router.put('/:transaction_id/agent-status',authenticate,transactionUpdateValidation, updateAgentTransactionStatusHandler,calculateAgentCommissionMiddleware);
// Route untuk memperbarui beberapa transaksi sekaligus berdasarkan array transaction_ids
router.put('/multi-status', authenticate, updateMultiTransactionStatusHandler);


router.get('/',authenticate,getTransactions );

module.exports = router;
