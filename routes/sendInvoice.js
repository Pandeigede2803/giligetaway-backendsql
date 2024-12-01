// /backend/routes/sendInvoice.js
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const Handlebars = require('handlebars');
const nodemailer = require('nodemailer');

router.post('/send-invoice', async (req, res) => {
  try {
    const { email, invoiceData } = req.body;

    // Validasi input
    if (!email || !invoiceData) {
      return res.status(400).json({ success: false, message: 'Data tidak valid' });
    }

    const templatePath = path.join(__dirname, '..', 'templates', 'invoice.hbs');
    const templateSource = fs.readFileSync(templatePath, 'utf-8');
    const template = Handlebars.compile(templateSource);

    const invoiceHtml = template(invoiceData);

    // Konfigurasi Nodemailer
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'mail.headlessexploregilis.my.id',
      port: Number(process.env.SMTP_PORT) || 465,
      secure: true,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    // Kirim email dengan invoice HTML
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Invoice Anda',
      html: invoiceHtml,
    });

    res.json({ success: true, message: 'Invoice berhasil dikirim' });
  } catch (error) {
    console.error('Error sending invoice:', error);
    res.status(500).json({ success: false, message: 'Gagal mengirim invoice' });
  }
});

module.exports = router;
