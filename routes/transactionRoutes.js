// routes/transactionRoutes.js
const express = require('express');
const router = express.Router();
const { updateTransactionStatusHandler,getTransactions, updateMultiTransactionStatusHandler,updateMultiAgentTransactionStatus, updateAgentTransactionStatusHandler } = require('../controllers/transactionController');
const authenticate = require('../middleware/authenticate');
const {transactionUpdateValidation,validateTransactionUpdate,transactionIdsValidation} = require('../validation/transcationUpdateValidation');
const calculateAgentCommissionMiddleware = require('../middleware/calculateAgentComissionMiddleware');


router.put('/:transaction_id/status',authenticate,transactionUpdateValidation, updateTransactionStatusHandler);

router.put('/:transaction_id/agent-status',authenticate,transactionUpdateValidation, updateAgentTransactionStatusHandler);
// Route untuk memperbarui beberapa transaksi sekaligus berdasarkan array transaction_ids
router.put('/multi-status', authenticate,transactionIdsValidation,validateTransactionUpdate, updateMultiTransactionStatusHandler);
router.put('/multi-status-agent', authenticate, updateMultiAgentTransactionStatus);


router.get('/',authenticate,getTransactions );

module.exports = router;
