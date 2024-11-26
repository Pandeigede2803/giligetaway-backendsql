const express = require('express');
const router = express.Router();
const dokuController = require("../controllers/dokuController");




const paymentController = require('../controllers/paymentController');
const { validateMidtransPaymentMethod, validatePayPalPaymentMethod,
    validateMidtransPaymentMethodMulti, validatePayPalPaymentMethodMulti
 } = require('../middleware/paymentValidation');
const {handleMidtransNotification} = require('../controllers/paymentController');
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

// Rute untuk menerima notifikasi dari Midtrans
router.post('/midtrans-notification', handleMidtransNotification);




// Route untuk mendapatkan daftar payment channels
router.get("/doku/payment-channels", dokuController.getPaymentChannels);

// Route untuk membuat pembayaran
router.post("/doku/create-payment", dokuController.createPayment);

// Route untuk menangani notifikasi dari DOKU
router.post("/doku-notification", dokuController.handleNotification);
// api/payment/doku-notification


module.exports = router;


module.exports = router;
