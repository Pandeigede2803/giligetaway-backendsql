// routes/paymentRoutes.js
const express = require('express');
const {sendInvoiceAndEticketEmail,sendNotificationEmail } = require('../controllers/emailController');
const router = express.Router();

// Route to send invoice email
router.post('/send-invoice-eticket', sendInvoiceAndEticketEmail);

// Route to send notification email
router.post('/send-notification', sendNotificationEmail);

module.exports = router;
