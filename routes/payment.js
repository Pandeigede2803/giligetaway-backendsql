const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { validateMidtransPaymentMethod, validatePayPalPaymentMethod,
    validateMidtransPaymentMethodMulti, validatePayPalPaymentMethodMulti
 } = require('../middleware/paymentValidation');

// Route to create a MidTrans transaction
router.post('/midtrans/create-transaction',validateMidtransPaymentMethod, paymentController.createMidtransTransaction);
router.post('/midtrans/create-transaction-multi',validateMidtransPaymentMethodMulti, paymentController.createMidtransTransactionMulti);

// Route to create a PayPal order
router.post('/paypal/create-order',validatePayPalPaymentMethod, paymentController.createPayPalTransaction);

// Route to create a PayPal order
router.post('/paypal/capture-order', paymentController.handlePayPalReturn);


// Route to create a MidTrans transaction
// router.post('/midtrans/create-transaction-link', validateMidtransPaymentMethod, paymentController.createMidtransTransactionLink);
router.post('/midtrans/create-transaction-link',validateMidtransPaymentMethod,  paymentController.generateMidtransLink);
// Route to create a MidTrans transaction
// router.post('/midtrans/link-multi', validateMidtransPaymentMethodMulti, paymentController.createMidtransMulti);
router.post('/midtrans/link-multi', validateMidtransPaymentMethodMulti, paymentController.generateSingleMidtransLink);

module.exports = router;
