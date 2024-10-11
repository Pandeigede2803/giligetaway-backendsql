const nodemailer = require('nodemailer');
const puppeteer = require('puppeteer');
const { getInvoiceHtml, getEticketHtml } = require('../util/emailUtils');
const { fetchMidtransPaymentStatus, fetchPaypalPaymentStatus, fetchPaymentStatus } = require('../util/payment/fetchPaymentStatus');
const staffEmail = process.env.STAFF_EMAIL;

// Fungsi untuk mengenerate PDF dari HTML menggunakan satu instance browser
let browser;

const initializeBrowser = async () => {
    if (!browser) {
        browser = await puppeteer.launch({ headless: true });
    }
};

const generatePDF = async (htmlContent) => {
    try {
        await initializeBrowser();
        const page = await browser.newPage();
        await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
        const pdfBuffer = await page.pdf({ format: 'A4' });
        await page.close();
        return pdfBuffer;
    } catch (error) {
        console.error('Error generating PDF:', error.message);
        throw new Error('Failed to generate PDF');
    }
};

// Fungsi umum untuk mengirim email dengan lampiran
const sendEmailWithAttachments = async (to, subject, text, attachments) => {
    try {
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
    } catch (error) {
        console.error('Error sending email:', error.message);
        throw new Error('Failed to send email');
    }
};

// Fungsi untuk mengirim Invoice dan E-Ticket
// Fungsi untuk mengirim Invoice dan E-Ticket dengan status pembayaran
exports.sendInvoiceAndEticketEmail = async (req, res) => {
    const { transactionId, email, finalState } = req.body;

    try {
        // Use the refactored payment status function
        const paymentStatusResponse = await fetchPaymentStatus(transactionId, finalState.paymentMethod);
        const { paymentStatus, orderId } = paymentStatusResponse;

        // Generate Invoice HTML dan PDF
        const invoiceHtml = getInvoiceHtml(transactionId, finalState.orderDetails, finalState.bookingData, finalState.gross_amount);
        const invoicePdf = await generatePDF(invoiceHtml);

        // Generate E-Ticket HTML dan PDF
        const eticketHtml = getEticketHtml(transactionId, finalState.orderDetails, finalState.bookingData, finalState.passengers, finalState.checkinTime, finalState.transportStatus);
        const eticketPdf = await generatePDF(eticketHtml);

        // Kirim Email ke Customer dengan Invoice dan E-Ticket
        await sendEmailWithAttachments(
            email,
            `Invoice and E-Ticket for Transaction: ${transactionId} - Payment Status: ${paymentStatus}`,
            `Dear Customer, \n\nYour transaction ${transactionId} was processed with payment status: ${paymentStatus}. Please find attached your invoice and e-ticket.\n\nThank you for your booking.`,
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
        // Use the refactored payment status function
        const paymentStatusResponse = await fetchPaymentStatus(transactionId, finalState.paymentMethod);
        const { paymentStatus, orderId } = paymentStatusResponse;

        // Generate Invoice HTML dan PDF
        const invoiceHtml = getInvoiceHtml(transactionId, finalState.orderDetails, finalState.bookingData, finalState.gross_amount);
        const invoicePdf = await generatePDF(invoiceHtml);

        // Generate E-Ticket HTML dan PDF
        const eticketHtml = getEticketHtml(transactionId, finalState.orderDetails, finalState.bookingData, finalState.passengers, finalState.checkinTime, finalState.transportStatus);
        const eticketPdf = await generatePDF(eticketHtml);

        // Kirim Email ke Staff dengan Invoice dan E-Ticket
        await sendEmailWithAttachments(
            staffEmail,
            `Notification for Transaction: ${transactionId} - Payment Status: ${paymentStatus}`,
            `Dear Admin, \n\nA new booking has been made with transaction ID: ${transactionId} and payment status: ${paymentStatus}. Attached are the invoice and e-ticket.`,
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

// Handle server shutdown to close browser instance
process.on('exit', async () => {
    if (browser) {
        await browser.close();
    }
});

process.on('SIGINT', async () => {
    if (browser) {
        await browser.close();
        process.exit(0);
    }
});
