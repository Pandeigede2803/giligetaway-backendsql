const axios = require("axios");
const crypto = require("crypto");
const { generateSignature } = require("../config/doku");

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

// Membuat pembayaran
// exports.createPayment = async (req, res) => {
//   try {
//     const paymentData = req.body;

//     const response = await dokuApi.post("/checkout/v1/payment", paymentData);
//     res.status(200).json({
//       success: true,
//       message: "Payment created successfully",
//       data: response.data,
//     });
//   } catch (error) {
//     console.error("Error creating payment:", error.response?.data || error.message);
//     res.status(500).json({
//       success: false,
//       message: "Failed to create payment",
//       error: error.message,
//     });
//   }
// };

// Fungsi untuk membuat pembayaran di DOKU
exports.createPayment = async (req, res) => {
  try {
    // Langkah 1: Buat Request-Id (harus unik untuk setiap permintaan)
    const requestId = crypto.randomUUID();

    // Langkah 2: Buat Request-Timestamp dalam format ISO-8601 tanpa millisecond
    const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");

    // Langkah 3: Tentukan Request-Target (endpoint tujuan di DOKU)
    const requestTarget = "/checkout/v1/payment";

    // Langkah 4: Ambil body dari permintaan yang masuk
    const body = req.body;

    // Langkah 5: Buat Signature untuk permintaan
    const signature = generateSignature(
      body,
      requestId,
      timestamp,
      requestTarget
    );

    // Langkah 6: Kirim permintaan ke API DOKU
    const response = await axios.post(
      `${DOKU_BASE_URL}${requestTarget}`,
      body,
      {
        headers: {
          "Client-Id": CLIENT_ID, // Client ID dari DOKU
          "Request-Id": requestId, // ID unik untuk permintaan ini
          "Request-Timestamp": timestamp, // Waktu saat permintaan dibuat
          Signature: signature, // Signature untuk validasi keamanan
          "Content-Type": "application/json", // Format konten yang dikirim (JSON)
        },
      }
    );

    // Jika berhasil, kirim respons dengan URL pembayaran ke frontend
    res.status(200).json({
      success: true,
      message: "Payment created successfully",
      data: response.data, // Data dari API DOKU (termasuk URL pembayaran)
    });
  } catch (error) {
    // Jika ada error, log error dan kirim respons gagal
    console.error(
      "Error creating payment:",
      error.response?.data || error.message
    );
    res.status(500).json({
      success: false,
      message: "Failed to create payment",
      error: error.response?.data || error.message,
    });
  }
};
exports.handleNotification = async (req, res) => {
    try {
      const notificationData = req.body;
  
      // Log data notifikasi untuk debugging
      console.log("😻Notifikasi diterima dari DOKU:", notificationData);
  
      // Proses data notifikasi sesuai kebutuhan
      if (notificationData.order && notificationData.order.invoice_number) {
        const invoiceNumber = notificationData.order.invoice_number;
        const paymentStatus =
          notificationData.transaction && notificationData.transaction.status;
        const transactionId =
          notificationData.transaction && notificationData.transaction.id;
        const grossAmount =
          notificationData.order && notificationData.order.amount;
  
        console.log(
          `Update status pembayaran untuk Invoice ${invoiceNumber} ke ${paymentStatus}`
        );
  
        // Lakukan pembaruan ke database Anda di sini
  
        // Kirim notifikasi ke klien melalui WebSocket
        broadcast({
          orderId: invoiceNumber,
          transactionStatus: paymentStatus,
          transactionId,
          grossAmount,
          notificationData,
          message: `Status pembayaran untuk Invoice ${invoiceNumber} diperbarui menjadi ${paymentStatus}`,
        });
      }
  
      // Kirim respons sukses ke DOKU
      res.status(200).send("OK");
    } catch (error) {
      console.error("Error memproses notifikasi:", error.message);
      res.status(500).json({ message: "Gagal memproses notifikasi" });
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
  