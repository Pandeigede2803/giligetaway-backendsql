const axios = require("axios");
const crypto = require("crypto");
const { generateSignature } = require("../config/doku");
const { broadcast } = require('../config/websocket'); 

const { Op, literal, col } = require("sequelize");
const {
  Agent,
  Boat,
  AgentMetrics,
  Booking,
  sequelize,
  Destination,
  Schedule,
  SubSchedule,
  Transport,
  Passenger,
  Transit,
  TransportBooking,
  AgentCommission,
  Transaction,
} = require("../models"); // Pastikan jalur impor benar
const { sendInvoiceAndTicketEmail,sendInvoiceAndTicketEmailRoundTrip } = require("../util/sendInvoiceAndTicketEmail");

const DOKU_BASE_URL = process.env.DOKU_BASE_URL;
const CLIENT_ID = process.env.DOKU_CLIENT_ID;
// Mendapatkan daftar payment channels
exports.getPaymentChannels = async (req, res) => {
  try {
    const response = await dokuApi.get("/checkout/v1/payment-channels");
    res.status(200).json({
      success: true,
      data: response.data,
    });
  } catch (error) {
    console.error(
      "Error fetching payment channels:",
      error.response?.data || error.message
    );
    res.status(500).json({
      success: false,
      message: "Failed to fetch payment channels",
      error: error.message,
    });
  }
};



// Fungsi untuk membuat pembayaran di DOKU
exports.createPayment = async (req, res) => {
  console.log("=== PAYMENT REQUEST STARTED ===");
  console.log("Request body:", JSON.stringify(req.body, null, 2));
  
  try {
    // Step 1: Create Request-Id (must be unique for each request)
    const requestId = crypto.randomUUID();
    console.log("Generated Request-Id:", requestId);
    
    // Step 2: Create Request-Timestamp in ISO-8601 format without milliseconds
    const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
    console.log("Generated Timestamp:", timestamp);
    
    // Step 3: Define Request-Target (DOKU endpoint)
    const requestTarget = "/checkout/v1/payment";
    console.log("Request-Target:", requestTarget);
    
    // Step 4: Get body from incoming request
    const body = req.body;
    
    // Log the specific fields that DOKU requires
    console.log("Invoice Number:", body.order?.invoice_number);
    console.log("Amount:", body.order?.amount);
    console.log("Currency:", body.order?.currency);
    
    // Step 5: Create Signature for the request
    const signature = generateSignature(
      body,
      requestId,
      timestamp,
      requestTarget
    );
    console.log("Signature generated successfully");
    
    // Log the complete request that will be sent to DOKU
    console.log("Full DOKU API request:", {
      url: `${DOKU_BASE_URL}${requestTarget}`,
      headers: {
        "Client-Id": CLIENT_ID,
        "Request-Id": requestId,
        "Request-Timestamp": timestamp,
        "Content-Type": "application/json"
      },
      body: body
    });
    
    // Step 6: Send request to DOKU API
    console.log("Sending request to DOKU...");
    const response = await axios.post(
      `${DOKU_BASE_URL}${requestTarget}`,
      body,
      {
        headers: {
          "Client-Id": CLIENT_ID,
          "Request-Id": requestId,
          "Request-Timestamp": timestamp,
          Signature: signature,
          "Content-Type": "application/json",
        },
      }
    );
    
    // Log the complete response from DOKU
    console.log("DOKU API Response Status:", response.status);
    console.log("DOKU API Response Headers:", JSON.stringify(response.headers, null, 2));
    console.log("DOKU API Response Data:", JSON.stringify(response.data, null, 2));
    
    // Check if the response contains payment_url
    if (response.data && response.data.payment_url) {
      console.log("Payment URL received successfully:", response.data.payment_url);
    } else {
      console.warn("No payment_url in DOKU response:", response.data);
    }
    
    // Send response back to frontend
    console.log("Sending success response to client");
    res.status(200).json({
      success: true,
      message: "Payment created successfully",
      data: response.data,
    });
    
  } catch (error) {
    // Enhanced error logging
    console.error("=== PAYMENT ERROR OCCURRED ===");
    console.error("Error creating payment");
    
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.error("Error Status:", error.response.status);
      console.error("Error Headers:", JSON.stringify(error.response.headers, null, 2));
      console.error("Error Data:", JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      // The request was made but no response was received
      console.error("No response received from DOKU API");
      console.error("Request details:", error.request);
    } else {
      // Something happened in setting up the request that triggered an Error
      console.error("Error message:", error.message);
    }
    
    // Send error response to client
    res.status(500).json({
      success: false,
      message: "Failed to create payment",
      error: error.response?.data || error.message,
    });
  }
  
  console.log("=== PAYMENT REQUEST COMPLETED ===");
};




exports.handleNotification = async (req, res) => {
  try {
    const notificationData = req.body;

    // Log notifikasi untuk debugging
    console.log("😻Notifikasi diterima dari DOKU:", notificationData);

    // Ekstrak data penting dari notifikasi
    if (notificationData.order && notificationData.order.invoice_number) {
      const invoiceNumber = notificationData.order.invoice_number;
      const paymentStatus = notificationData.transaction?.status || "UNKNOWN";
      
      console.log(`Update status pembayaran untuk Invoice ${invoiceNumber} ke ${paymentStatus}`);

      // Cari transaksi yang sesuai dengan invoice number
      const transaction = await Transaction.findOne({
        where: {
          transaction_id: invoiceNumber
        },
        include: [
          {
            model: Booking,
            as: 'booking',
          },
        ],
      });

      if (!transaction) {
        console.error(`Transaction not found for invoice number: ${invoiceNumber}`);
        res.status(200).send("OK");
        return;
      }

      const booking = transaction.booking;

      if (!booking) {
        console.error(`Booking not found for transaction: ${transaction.id}`);
        res.status(200).send("OK");
        return;
      }

      // Jika booking sudah paid, skip update
      if (booking.payment_status === 'paid') {
        console.log(`ℹ️ Booking ${booking.id} sudah paid, skip update`);
        res.status(200).send("OK");
        return;
      }

      // Update status transaksi dan simpan data notifikasi
      await transaction.update({
        status: paymentStatus.toLowerCase(),
        payment_data: notificationData,
        payment_method: notificationData.service?.id || 'DOKU',
        paid_at: new Date()
      });

      console.log(`Transaction ${transaction.id} updated with payment data`);

      // Jika pembayaran berhasil, update status booking dan kirim email
      if (paymentStatus === 'SUCCESS') {
        await booking.update({
          payment_status: 'paid',
          payment_method: notificationData.service?.id || 'DOKU',
          expiration_time: null,
        });
        
        console.log(`Booking ${booking.id} marked as paid`);

        // Cek apakah ini round trip ticket
        if (booking.ticket_id && booking.ticket_id.includes('GG-RT-')) {
          console.log(`🔄 Processing round trip booking: ${booking.ticket_id}`);
          await handleRoundTripBooking(booking, invoiceNumber);
        } else {
          // Regular one-way booking - just pass the email, booking, and invoiceNumber
          try {
            await sendInvoiceAndTicketEmail(booking.contact_email, booking, invoiceNumber);
            console.log(`📧 Email sent for booking ${booking.id}`);
          } catch (emailError) {
            console.error(`Error sending email for booking ${booking.id}:`, emailError.message);
          }
        }
      }

      // Kirim notifikasi ke klien melalui WebSocket
      if (typeof broadcast === 'function') {
        broadcast({
          orderId: invoiceNumber,
          transactionStatus: paymentStatus,
          grossAmount: notificationData.order?.amount,
          message: `Status pembayaran untuk Invoice ${invoiceNumber} diperbarui menjadi ${paymentStatus}`
        });
      }
    } else {
      console.error("Invalid notification data: missing order or invoice_number");
    }

    // Selalu kirim respons sukses ke DOKU untuk menghentikan percobaan ulang
    res.status(200).send("OK");
  } catch (error) {
    console.error("Error memproses notifikasi:", error.message);
    console.error(error.stack);
    
    // Tetap kirim response 200 OK untuk mencegah DOKU mengirim ulang notifikasi
    res.status(200).send("OK");
  }
};

// Helper untuk menangani round trip booking
async function handleRoundTripBooking(currentBooking, invoiceNumber) {
  try {
    const ticketId = currentBooking.ticket_id;
    const ticketNumber = parseInt(ticketId.split('-')[2], 10);

    // Cari dua kemungkinan pasangan: -1 dan +1
    const pairTicketIdMinus = `GG-RT-${ticketNumber - 1}`;
    const pairTicketIdPlus = `GG-RT-${ticketNumber + 1}`;

    console.log("🔍 Checking round-trip pairs...");
    console.log("  current ticket_id:", ticketId);
    console.log("  trying pair ticket_ids:", pairTicketIdMinus, "and", pairTicketIdPlus);

    let pairBooking = await Booking.findOne({
      where: { ticket_id: pairTicketIdMinus },
      include: [{ model: Transaction, as: 'transactions' }],
    });

    if (!pairBooking) {
      pairBooking = await Booking.findOne({
        where: { ticket_id: pairTicketIdPlus },
        include: [{ model: Transaction, as: 'transactions' }],
      });
    }

    if (pairBooking) {
      console.log(`✅ Pair booking found: ${pairBooking.ticket_id}`);
      
      // Update booking pasangan
      await pairBooking.update({
        payment_status: 'paid',
        payment_method: currentBooking.payment_method,
        expiration_time: null,
      });

      const pairTx = pairBooking.transactions?.[0];
      if (pairTx) {
        await pairTx.update({
          status: 'paid',
          paid_at: new Date(),
        });
      }

      // Kirim email dari booking yang ganjil jika keduanya ada
      const currentNumberIsOdd = ticketNumber % 2 === 1;
      let emailFromBooking = currentBooking;
      let secondBooking = pairBooking;

      if (pairBooking) {
        const pairNumber = parseInt(pairBooking.ticket_id.split('-')[2], 10);
        const pairIsOdd = pairNumber % 2 === 1;

        if (currentNumberIsOdd) {
          emailFromBooking = currentBooking;
          secondBooking = pairBooking;
        } else if (pairIsOdd) {
          emailFromBooking = pairBooking;
          secondBooking = currentBooking;
        }
      }

      // Simply pass the email, bookings, and invoiceNumber to your existing util
      await sendInvoiceAndTicketEmailRoundTrip(
        emailFromBooking.contact_email,
        emailFromBooking,
        secondBooking,
        invoiceNumber
      );
      console.log(`📧 [RT] Email sent from booking ${emailFromBooking.ticket_id}`);
    } else {
      console.warn(`❌ Pair booking not found. Sending single booking email.`);
      // Jika tidak ada pasangan, kirim email untuk single booking
      await sendInvoiceAndTicketEmail(currentBooking.contact_email, currentBooking, invoiceNumber);
    }
  } catch (error) {
    console.error("Error handling round trip booking:", error.message);
    console.error(error.stack);
    throw error;
  }
}

exports.createSnapToken = async (req, res) => {
    try {
      const requestId = crypto.randomUUID();
      const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
      const requestTarget = "/checkout/v1/payment";
      const body = req.body;
  
      const signature = generateSignature(body, requestId, timestamp, requestTarget);
  
      const response = await axios.post(`${DOKU_BASE_URL}${requestTarget}`, body, {
        headers: {
          "Client-Id": CLIENT_ID,
          "Request-Id": requestId,
          "Request-Timestamp": timestamp,
          Signature: signature,
          "Content-Type": "application/json",
        },
      });
  
      // Kirim Snap Token ke frontend
      const snapToken = response.data.response.payment.token_id;
      res.status(200).json({
        success: true,
        snapToken,
      });
    } catch (error) {
      console.error("Error creating Snap Token:", error.response?.data || error.message);
      res.status(500).json({
        success: false,
        message: "Failed to create Snap Token",
        error: error.response?.data || error.message,
      });
    }
  };
  