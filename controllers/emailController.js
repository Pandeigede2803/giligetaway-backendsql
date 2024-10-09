const nodemailer = require('nodemailer');
const puppeteer = require('puppeteer');
const { getInvoiceHtml, getEticketHtml } = require('../util/emailUtils');
const staffEmail = process.env.STAFF_EMAIL;

// Fungsi untuk mengenerate PDF dari HTML
const generatePDF = async (htmlContent) => {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({ format: 'A4' });
    await browser.close();
    return pdfBuffer;
};

// Fungsi umum untuk mengirim email dengan lampiran
const sendEmailWithAttachments = async (to, subject, text, attachments) => {
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASSWORD,
        },
    });

    const mailOptions = {
        from: process.env.EMAIL_USER,
        to,
        subject,
        text,
        attachments,
    };

    await transporter.sendMail(mailOptions);
};

// Fungsi untuk mengirim Invoice dan E-Ticket
exports.sendInvoiceAndEticketEmail = async (req, res) => {
    const { transactionId, email, finalState } = req.body;

    try {
        // Generate Invoice HTML dan PDF
        const invoiceHtml = getInvoiceHtml(transactionId, finalState.orderDetails, finalState.bookingData, finalState.gross_amount);
        const invoicePdf = await generatePDF(invoiceHtml);

        // Generate E-Ticket HTML dan PDF
        const eticketHtml = getEticketHtml(transactionId, finalState.orderDetails, finalState.bookingData, finalState.passengers, finalState.checkinTime, finalState.transportStatus);
        const eticketPdf = await generatePDF(eticketHtml);

        // Kirim Email ke Customer dengan Invoice dan E-Ticket
        await sendEmailWithAttachments(
            email,
            `Invoice and E-Ticket for Transaction: ${transactionId}`,
            `Dear Customer, \n\nYour transaction ${transactionId} was successful. Please find attached your invoice and e-ticket.\n\nThank you for your booking.`,
            [
                { filename: `Invoice_${transactionId}.pdf`, content: invoicePdf },
                { filename: `E-Ticket_${transactionId}.pdf`, content: eticketPdf }
            ]
        );

        return res.status(200).json({ message: 'Invoice and E-Ticket email sent successfully' });
    } catch (error) {
        console.error('Error sending email:', error.message);
        return res.status(500).json({ error: 'Failed to send email' });
    }
};

// Fungsi untuk mengirim Notifikasi ke Staff dengan Invoice dan E-Ticket
exports.sendNotificationEmail = async (req, res) => {
    const { transactionId, finalState } = req.body;

    try {
        // Generate Invoice HTML dan PDF
        const invoiceHtml = getInvoiceHtml(transactionId, finalState.orderDetails, finalState.bookingData, finalState.gross_amount);
        const invoicePdf = await generatePDF(invoiceHtml);

        // Generate E-Ticket HTML dan PDF
        const eticketHtml = getEticketHtml(transactionId, finalState.orderDetails, finalState.bookingData, finalState.passengers, finalState.checkinTime, finalState.transportStatus);
        const eticketPdf = await generatePDF(eticketHtml);

        // Kirim Email ke Staff dengan Invoice dan E-Ticket
        await sendEmailWithAttachments(
            staffEmail,
            `Notification for Transaction: ${transactionId}`,
            `Dear Admin, \n\nA new booking has been made with transaction ID: ${transactionId}. Attached are the invoice and e-ticket.`,
            [
                { filename: `Invoice_${transactionId}.pdf`, content: invoicePdf },
                { filename: `E-Ticket_${transactionId}.pdf`, content: eticketPdf }
            ]
        );

        return res.status(200).json({ message: 'Notification email sent successfully' });
    } catch (error) {
        console.error('Error sending notification email:', error.message);
        return res.status(500).json({ error: 'Failed to send notification email' });
    }
};
