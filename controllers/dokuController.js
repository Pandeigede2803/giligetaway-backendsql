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

      // Cari transaksi yang sesuai dengan invoice number (TRANS format)
      const transaction = await Transaction.findOne({
        where: {
          transaction_id: invoiceNumber
        }
      });

      if (transaction) {
        // Update status transaksi dan simpan data notifikasi
        await transaction.update({
          status: paymentStatus.toLowerCase(),
          payment_data: notificationData // Sequelize akan mengonversi objek ke JSON
        });

        console.log(`Transaction ${transaction.id} updated with payment data`);

        // Jika pembayaran berhasil, update status booking
        if (paymentStatus === 'SUCCESS') {
          const booking = await Booking.findByPk(transaction.booking_id);
          
          if (booking) {
            await booking.update({
              payment_status: 'paid'
            });
            
            console.log(`Booking ${booking.id} marked as paid`);
          } else {
            console.error(`Booking not found for transaction: ${transaction.id}`);
          }
        }

        // Kirim notifikasi ke klien melalui WebSocket
        broadcast({
          orderId: invoiceNumber,
          transactionStatus: paymentStatus,
          grossAmount: notificationData.order?.amount,
          message: `Status pembayaran untuk Invoice ${invoiceNumber} diperbarui menjadi ${paymentStatus}`
        });
      } else {
        console.error(`Transaction not found for invoice number: ${invoiceNumber}`);
      }
    } else {
      console.error("Invalid notification data: missing order or invoice_number");
    }

    // Selalu kirim respons sukses ke DOKU untuk menghentikan percobaan ulang
    res.status(200).send("OK");
  } catch (error) {
    console.error("Error memproses notifikasi:", error.message);
    
    // Log stack trace untuk debugging
    console.error(error.stack);
    
    // Tetap kirim response 200 OK untuk mencegah DOKU mengirim ulang notifikasi
    // Ini adalah praktik umum untuk webhook, bahkan jika terjadi error
    res.status(200).send("OK");
  }
};

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
  