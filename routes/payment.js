const express = require('express');
const router = express.Router();
const dokuController = require("../controllers/dokuController");
const { sendPurchaseToGA4 } = require("../util/ga4Tracker");



const paymentController = require('../controllers/paymentController');
const { validateMidtransPaymentMethod, validatePayPalPaymentMethod,
    validateMidtransPaymentMethodMulti, validatePayPalPaymentMethodMulti
 } = require('../middleware/paymentValidation');
const {handleMidtransNotification,handleWebhook} = require('../controllers/paymentController');
// Route to create a MidTrans transaction
router.post('/midtrans/create-transaction',validateMidtransPaymentMethod, paymentController.createMidtransTransaction);
router.post('/midtrans/create-transaction-multi',validateMidtransPaymentMethodMulti, paymentController.createMidtransTransactionMulti);

// Route to create a PayPal order
router.post('/paypal/create-order',validatePayPalPaymentMethod, paymentController.createPayPalTransaction);

router.post('/paypal/create-order-multi',validatePayPalPaymentMethodMulti ,paymentController.createPayPalMultiple);

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
// Rute untuk menerima notifikasi dari Midtrans
router.post('/paypal/webhook', handleWebhook);;




// Contoh URL: GET /api/ga4/test?tx=GG-TEST-123&amount=500000
router.get("/testga4", async (req, res) => {
  try {
    const { tx, amount } = req.query;

    if (!tx || !amount) {
      return res.status(400).json({
        success: false,
        message: "Missing query params: tx & amount are required",
      });
    }

    await sendPurchaseToGA4(tx, amount, "IDR");

    res.json({
      success: true,
      message: `✅ Test purchase event sent to GA4 for ${tx}`,
    });
  } catch (err) {
    console.error("Error testing GA4:", err.message);
    res.status(500).json({
      success: false,
      message: "❌ Error testing GA4 event",
    });
  }
});

// Route untuk mendapatkan daftar payment channels
router.get("/doku/payment-channels", dokuController.getPaymentChannels);

// Route untuk membuat pembayaran
router.post("/doku/create-payment", dokuController.createPayment);
// Route untuk membuat pembayaran
router.post("/doku/create-snap-token", dokuController.createSnapToken);

// Route untuk menangani notifikasi dari DOKU
router.post("/doku-notification", dokuController.handleNotification);
// api/payment/doku-notification


module.exports = router;


