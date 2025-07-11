// routes/transactionRoutes.js
const express = require('express');
const router = express.Router();
const { updateTransactionStatusHandler,getTransactions, updateMultiTransactionStatusHandler,updateMultiAgentTransactionStatus,
     updateAgentTransactionStatusHandler, updateAgentTransactionStatusHandlerWithEmail,updateMultiAgentTransactionStatusWithEmail } = require('../controllers/transactionController');
const authenticate = require('../middleware/authenticate');
const {transactionUpdateValidation,validateTransactionUpdate,transactionIdsValidation} = require('../validation/transcationUpdateValidation');
const calculateAgentCommissionMiddleware = require('../middleware/calculateAgentComissionMiddleware');


// status: 404,
// url: 'http://localhost:8000/api/transactions/TRANS-1743326884022/status',
// method: 'PUT',
// response: 'PRO FEATURE ONLY'
router.put('/:transaction_id/status',authenticate,transactionUpdateValidation, updateTransactionStatusHandler);

router.put('/:transaction_id/agent-status',authenticate,transactionUpdateValidation, updateAgentTransactionStatusHandler);
router.put('/:transaction_id/agent-status-email',authenticate,transactionUpdateValidation, updateAgentTransactionStatusHandlerWithEmail);
// Route untuk memperbarui beberapa transaksi sekaligus berdasarkan array transaction_ids
router.put('/multi-status', authenticate,transactionIdsValidation,validateTransactionUpdate, updateMultiTransactionStatusHandler);
router.put('/multi-status-agent', authenticate,transactionIdsValidation, updateMultiAgentTransactionStatus);
router.put('/multi-status-agent-email', authenticate,transactionIdsValidation, updateMultiAgentTransactionStatusWithEmail);


router.get('/',authenticate,getTransactions );

module.exports = router;
