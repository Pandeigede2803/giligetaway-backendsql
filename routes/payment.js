const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { validateMidtransPaymentMethod, validatePayPalPaymentMethod } = require('../middleware/paymentValidation');

// Route to create a MidTrans transaction
router.post('/midtrans/create-transaction',validateMidtransPaymentMethod, paymentController.createMidtransTransaction);

// Route to create a PayPal order
router.post('/paypal/create-order',validatePayPalPaymentMethod, paymentController.createPayPalTransaction);

// Route to create a PayPal order
router.post('/paypal/capture-order', paymentController.handlePayPalReturn);


// Route to create a MidTrans transaction
router.post('/midtrans/create-transaction-link', validateMidtransPaymentMethod, paymentController.createMidtransTransactionLink);


module.exports = router;
