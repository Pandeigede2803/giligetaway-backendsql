const axios = require("axios");
const crypto = require("crypto");
const { generateSignature } = require("../config/doku");
const { broadcast } = require("../config/websocket");
const { sendPurchaseToGA4 } = require("../util/ga4Tracker");

const { Op, literal, col } = require("sequelize");
const {
  Agent,
  AgentMetrics,
  Booking,
  sequelize,
  SubSchedule,
  Transport,
  Transit,
  TransportBooking,
  AgentCommission,
  Transaction,
} = require("../models"); // Pastikan jalur impor benar
const {
  sendInvoiceAndTicketEmail,
  sendInvoiceAndTicketEmailRoundTrip,
  
} = require("../util/sendInvoiceAndTicketEmail");



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

    // // Log the specific fields that DOKU requires
    // console.log("Invoice Number:", body.order?.invoice_number);
    // console.log("Amount:", body.order?.amount);
    // console.log("Currency:", body.order?.currency);

    // Step 5: Create Signature for the request
    const signature = generateSignature(
      body,
      requestId,
      timestamp,
      requestTarget
    );
    console.log("Signature generated successfully");

    // // Log the complete request that will be sent to DOKU
    // console.log("Full DOKU API request:", {
    //   url: `${DOKU_BASE_URL}${requestTarget}`,
    //   headers: {
    //     "Client-Id": CLIENT_ID,
    //     "Request-Id": requestId,
    //     "Request-Timestamp": timestamp,
    //     "Content-Type": "application/json",
    //   },
    //   body: body,
    // });

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
    // console.log("DOKU API Response Status:", response.status);
    // console.log(
    //   "DOKU API Response Headers:",
    //   JSON.stringify(response.headers, null, 2)
    // );
    // console.log(
    //   "DOKU API Response Data:",
    //   JSON.stringify(response.data, null, 2)
    // );

    // Check if the response contains payment_url
    if (response.data && response.data.payment_url) {
      console.log(
        "Payment URL received successfully:",
        response.data.payment_url
      );
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
      console.error(
        "Error Headers:",
        JSON.stringify(error.response.headers, null, 2)
      );
      console.error(
        "Error Data:",
        JSON.stringify(error.response.data, null, 2)
      );
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
      message:
        "Failed to create payment, " +
        (error.response?.data?.message || error.message),
      error: {
        message: error.response?.data?.message || error.message,
        status: error.response?.status,
        headers: error.response?.headers,
        data: error.response?.data,
      },
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

      console.log(
        `Update status pembayaran untuk Invoice ${invoiceNumber} ke ${paymentStatus}`
      );

      // Cari transaksi yang sesuai dengan invoice number
      const transaction = await Transaction.findOne({
        where: {
          transaction_id: invoiceNumber,
        },
        include: [
          {
            model: Booking,
            as: "booking",
            include: [
              {
                model: AgentCommission,
                as: "agentCommission",
              },
              {
                model: Agent,
                as: "Agent",
              },
            ],
          },
        ],
      });

      if (!transaction) {
        console.error(
          `Transaction not found for invoice number: ${invoiceNumber}`
        );
        res.status(200).send("OK");
        return;
      }

      const booking = transaction.booking;
      const agentCommission = booking.agentCommission;
      const agent = booking.Agent;

      // 🚨 SERIOUS INDICATOR LOG - Cek Agent Commission sebelum update
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("🚨 [BEFORE UPDATE] Agent Commission Check for Booking:", booking.id);
      console.log("  Booking ID:", booking.id);
      console.log("  Ticket ID:", booking.ticket_id);
      console.log("  Agent ID:", booking.agent_id);
      console.log("  ✅ Agent Commission EXISTS:", !!agentCommission);
      console.log("  📊 Agent Commission ID:", agentCommission?.id);
      console.log("  💰 Agent Commission Amount:", agentCommission?.amount);
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

      if (!booking) {
        console.error(`Booking not found for transaction: ${transaction.id}`);
        res.status(200).send("OK");
        return;
      }

      // Jika booking sudah paid, skip update
      if (booking.payment_status === "paid") {
        console.log(`ℹ️ Booking ${booking.id} sudah paid, skip update`);
        res.status(200).send("OK");
        return;
      }

      // Update status transaksi dan simpan data notifikasi
      await transaction.update({
        status: paymentStatus.toLowerCase(),
        payment_data: notificationData,
        payment_method: notificationData.service?.id || "DOKU",
        paid_at: new Date(),
      });

      // console.log(`Transaction ${transaction.id} updated with payment data`);

      // Jika pembayaran berhasil, update status booking dan kirim email
      if (paymentStatus === "SUCCESS") {
        // 🚨 SERIOUS INDICATOR LOG - Cek Agent Commission SESUDAH update
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log("🔄 [UPDATE START] Updating Booking:", booking.id);

        await booking.update({
          payment_status: "paid",
          payment_method: notificationData.service?.id || "DOKU",
          expiration_time: null,
        });

        // 🚨 SERIOUS INDICATOR LOG - Cek Agent Commission SETELAH update
        const updatedBookingAfterUpdate = await Booking.findByPk(booking.id, {
          include: [
            { model: AgentCommission, as: "agentCommission" },
            { model: Agent, as: "Agent" },
          ],
        });

        console.log("🔄 [UPDATE DONE] Booking updated successfully");
        console.log("  Booking ID:", updatedBookingAfterUpdate.id);
        console.log("  Payment Status:", updatedBookingAfterUpdate.payment_status);
        console.log("  ❌ Agent Commission EXISTS:", !!updatedBookingAfterUpdate.agentCommission);
        console.log("  📊 Agent Commission ID:", updatedBookingAfterUpdate.agentCommission?.id);
        console.log("  💰 Agent Commission Amount:", updatedBookingAfterUpdate.agentCommission?.amount);
        console.log("  ⚠️  AGENT COMMISSION HILANG???", !updatedBookingAfterUpdate.agentCommission && !!agentCommission);
        if (!updatedBookingAfterUpdate.agentCommission && agentCommission) {
          console.log("  🚨🚨🚨🚨 SERIOUS ERROR: Agent Commission HILANG setelah update Booking! 🚨🚨🚨🚨");
          console.log("     Sebelum update - ID:", agentCommission.id, "Amount:", agentCommission.amount);
          console.log("     Sesudah update - NULL/UNDEFINED!");
        }
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

          // ✅ Kirim ke GA4
  // await sendPurchaseToGA4(
  //   invoiceNumber,
  //   notificationData.order?.amount,
  //   "IDR"
  // );


        // console.log(`Booking ${booking.id} marked as paid`);

        // Cek apakah ini round trip ticket
        if (booking.ticket_id && booking.ticket_id.includes("GG-RT-")) {
          console.log(`🔄 Processing round trip booking: ${booking.ticket_id}`);
          await handleRoundTripBooking(booking, invoiceNumber, agent, agentCommission);
        } else {
          // Regular one-way booking - just pass the email, booking, and invoiceNumber
          try {
            await sendInvoiceAndTicketEmail(
              booking.contact_email,
              booking,
              invoiceNumber,
              agentCommission,
              agent
            );
            console.log(`📧 Email sent for booking ${booking.id}`);
          } catch (emailError) {
            console.error(
              `😻Error sending email for booking ${booking.id}:`,
              emailError.message
            );
          }
        }
      }

      // Kirim notifikasi ke klien melalui WebSocket
      if (typeof broadcast === "function") {
        broadcast({
          orderId: invoiceNumber,
          transactionStatus: paymentStatus,
          grossAmount: notificationData.order?.amount,
          message: `Status pembayaran untuk Invoice ${invoiceNumber} diperbarui menjadi ${paymentStatus}`,
        });
      }
    } else {
      console.error(
        "Invalid notification data: missing order or invoice_number"
      );
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
async function handleRoundTripBooking(currentBooking, invoiceNumber, agent, agentCommission) {
  try {
    const ticketId = currentBooking.ticket_id;
    const ticketNumber = parseInt(ticketId.split("-")[2], 10);

    // Format nomor tiket dengan zero-padding yang konsisten
    const pairTicketIdMinus = `GG-RT-${String(ticketNumber - 1).padStart(6, "0")}`;
    const pairTicketIdPlus = `GG-RT-${String(ticketNumber + 1).padStart(6, "0")}`;

    // console.log("🔍 Memeriksa pasangan round-trip...");
    // console.log("  Tiket saat ini:", ticketId);
    // console.log(
    //   "  Mencoba pasangan tiket:",
    //   pairTicketIdMinus,
    //   "dan",
    //   pairTicketIdPlus
    // );

    // Gunakan Sequelize Op.or untuk lebih efisien dan lebih jelas
    const { Op } = require("sequelize");

    let pairBooking = await Booking.findOne({
      where: {
        ticket_id: {
          [Op.or]: [pairTicketIdMinus, pairTicketIdPlus],
        },
      },
      include: [
        { model: Transaction, as: "transactions" },
        { model: AgentCommission, as: "agentCommission" },
        { model: Agent, as: "Agent" },
      ],
    });

    if (pairBooking) {
      console.log(`✅ Pasangan booking ditemukan: ${pairBooking.ticket_id}`);
      // console.log("Detail booking saat ini:", {
      //   id: currentBooking.ticket_id,
      //   status: currentBooking.payment_status,
      //   transaksi: currentBooking.transactions
      //     ? currentBooking.transactions.length
      //     : 0,
      // });
      // console.log("Detail booking pasangan:", {
      //   id: pairBooking.ticket_id,
      //   status: pairBooking.payment_status,
      //   transaksi: pairBooking.transactions
      //     ? pairBooking.transactions.length
      //     : 0,
      // });

      // Update booking satu per satu, tidak menggunakan Promise.all
      try {
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log("🚨 [ROUND TRIP] BEFORE UPDATE currentBooking:", currentBooking.ticket_id);
        console.log("  ✅ Has Agent Commission:", !!currentBooking.agentCommission);

        await currentBooking.update({
          payment_status: "paid",
          payment_method: currentBooking.payment_method,
          expiration_time: null,
        });

        // 🚨 SERIOUS INDICATOR LOG - Cek Agent Commission setelah update
        const updatedCurrentBooking = await Booking.findByPk(currentBooking.id, {
          include: [{ model: AgentCommission, as: "agentCommission" }],
        });
        console.log("🔄 [ROUND TRIP] currentBooking updated:", currentBooking.ticket_id);
        console.log("  ❌ Has Agent Commission:", !!updatedCurrentBooking.agentCommission);
        if (!updatedCurrentBooking.agentCommission && currentBooking.agentCommission) {
          console.log("  🚨🚨 AGENT COMMISSION HILANG currentBooking:", currentBooking.ticket_id);
        }
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      } catch (error) {
        console.error(
          `❌ Gagal memperbarui booking saat ini: ${currentBooking.ticket_id}`,
          error
        );
        throw error; // Hentikan eksekusi jika gagal
      }

      try {
        // console.log(
        //   `🔄 Memperbarui booking pasangan: ${pairBooking.ticket_id}`
        // );
        await pairBooking.update({
          payment_status: "paid",
          payment_method: currentBooking.payment_method,
          expiration_time: null,
        });
        console.log(
          `✅ Booking pasangan berhasil diperbarui: ${pairBooking.ticket_id}`
        );
      } catch (error) {
        console.error(
          `❌ Gagal memperbarui booking pasangan: ${pairBooking.ticket_id}`,
          error
        );
        throw error; // Hentikan eksekusi jika gagal
      }

      // Update transaksi secara individual dengan pengecekan keberadaan
      if (
        currentBooking.transactions &&
        currentBooking.transactions.length > 0
      ) {
        try {
          console.log(
            `🔄 Memperbarui transaksi untuk booking saat ini: ${currentBooking.ticket_id}`
          );
          await currentBooking.transactions[0].update({
            status: "paid",
            paid_at: new Date(),
          });
          console.log(`✅ Transaksi booking saat ini berhasil diperbarui`);
        } catch (error) {
          console.error(
            `❌ Gagal memperbarui transaksi booking saat ini: ${currentBooking.ticket_id}`,
            error
          );
          throw error;
        }
      } else {
        console.warn(
          `⚠️ Tidak ada transaksi untuk booking saat ini: ${currentBooking.ticket_id}`
        );
      }

      if (pairBooking.transactions && pairBooking.transactions.length > 0) {
        try {
          console.log(
            `🔄 Memperbarui transaksi untuk booking pasangan: ${pairBooking.ticket_id}`
          );
          await pairBooking.transactions[0].update({
            status: "paid",
            paid_at: new Date(),
          });
          console.log(`✅ Transaksi booking pasangan berhasil diperbarui`);
        } catch (error) {
          console.error(
            `❌ Gagal memperbarui transaksi booking pasangan: ${pairBooking.ticket_id}`,
            error
          );
          throw error;
        }
      } else {
        console.warn(
          `⚠️ Tidak ada transaksi untuk booking pasangan: ${pairBooking.ticket_id}`
        );
      }

      // Verifikasi hasil pembaruan
      const updatedCurrent = await Booking.findOne({
        where: { ticket_id: currentBooking.ticket_id },
        include: [
          { model: Transaction, as: "transactions" },
          { model: AgentCommission, as: "agentCommission" },
        ],
      });

      const updatedPair = await Booking.findOne({
        where: { ticket_id: pairBooking.ticket_id },
        include: [
          { model: Transaction, as: "transactions" },
          { model: AgentCommission, as: "agentCommission" },
        ],
      });

      console.log("📊 Hasil akhir pembaruan:");
      console.log("  Current booking:", {
        id: updatedCurrent.ticket_id,
        status: updatedCurrent.payment_status,
        transaksiStatus:
          updatedCurrent.transactions && updatedCurrent.transactions.length > 0
            ? updatedCurrent.transactions[0].status
            : "N/A",
        hasAgentCommission: !!updatedCurrent.agentCommission,
        agentCommissionId: updatedCurrent.agentCommission?.id,
      });
      console.log("  Pair booking:", {
        id: updatedPair.ticket_id,
        status: updatedPair.payment_status,
        transaksiStatus:
          updatedPair.transactions && updatedPair.transactions.length > 0
            ? updatedPair.transactions[0].status
            : "N/A",
        hasAgentCommission: !!updatedPair.agentCommission,
        agentCommissionId: updatedPair.agentCommission?.id,
      });

      // Kirim email dari booking yang ganjil jika keduanya ada
      const currentNumberIsOdd = ticketNumber % 2 === 1;
      let emailFromBooking = currentBooking;
      let secondBooking = pairBooking;

      if (pairBooking) {
        const pairNumber = parseInt(pairBooking.ticket_id.split("-")[2], 10);
        const pairIsOdd = pairNumber % 2 === 1;

        console.log("📧 Info pengiriman email:", {
          currentNumber: ticketNumber,
          currentIsOdd: currentNumberIsOdd,
          pairNumber: pairNumber,
          pairIsOdd: pairIsOdd,
        });

        if (currentNumberIsOdd) {
          emailFromBooking = currentBooking;
          secondBooking = pairBooking;
          console.log(
            `  Mengirim email dari booking saat ini: ${emailFromBooking.ticket_id}`
          );
        } else if (pairIsOdd) {
          emailFromBooking = pairBooking;
          secondBooking = currentBooking;
          console.log(
            `  Mengirim email dari booking pasangan: ${emailFromBooking.ticket_id}`
          );
        }
      }

      try {
        // Kirim email
        await sendInvoiceAndTicketEmailRoundTrip(
          emailFromBooking.contact_email,
          emailFromBooking,
          secondBooking,
          invoiceNumber,
          agent,
          agentCommission
        );
        console.log(
          `📧 [RT] Email berhasil dikirim dari booking ${emailFromBooking.ticket_id}`
        );
      } catch (error) {
        console.error("❌ Gagal mengirim email:", error);
        throw error;
      }
    } else {
      console.warn(
        `❌ Pasangan booking tidak ditemukan untuk ${currentBooking.ticket_id}. Mengirim email single booking.`
      );
      // Jika tidak ada pasangan, kirim email untuk single booking
      await sendInvoiceAndTicketEmail(
        currentBooking.contact_email,
        currentBooking,
        invoiceNumber
      );
    }
  } catch (error) {
    console.error("❌ Error menangani round trip booking:", error.message);
    console.error(error.stack);
    throw error;
  }
}

// Test route untuk query booking dan kirim email invoice & tiket berdasarkan ticket_id
// Mirip handleNotification tapi pakai ticket_id sebagai query key
exports.testGetByTicketId = async (req, res) => {
  try {
    const { ticket_id } = req.query;

    if (!ticket_id) {
      return res.status(400).json({
        success: false,
        message: "ticket_id is required in query params",
      });
    }

    console.log(`🔍 Testing query for ticket_id: ${ticket_id}`);

    // Cari transaction via booking ticket_id (sama kayak handleNotification)
    const transaction = await Transaction.findOne({
      where: {
        '$booking.ticket_id$': ticket_id,
      },
      include: [
        {
          model: Booking,
          as: "booking",
          include: [
            {
              model: AgentCommission,
              as: "agentCommission",
            },
            {
              model: Agent,
              as: "Agent",
            },
          ],
        },
      ],
    });

    if (!transaction) {
      console.error(`Transaction not found for ticket_id: ${ticket_id}`);
      res.status(404).json({
        success: false,
        message: `Transaction with ticket_id ${ticket_id} not found`,
      });
      return;
    }

    const booking = transaction.booking;
    const agentCommission = booking.agentCommission;
    const agent = booking.Agent;

    // Gunakan invoice number dari transaction
    const invoiceNumber = transaction.transaction_id;

    console.log(`✅ Booking found: ${booking.id}`);
    console.log(`📧 Invoice number: ${invoiceNumber}`);

    // Kirim email invoice & tiket (sama kayak handleNotification)
    try {
      // Cek apakah ini round trip ticket (GG-RT-)
      if (booking.ticket_id && booking.ticket_id.includes("GG-RT-")) {
        console.log(`🔄 Processing round trip booking: ${booking.ticket_id}`);
        await handleRoundTripBooking(booking, invoiceNumber, agent, agentCommission);
      } else {
        // Regular one-way booking - kirim email
        await sendInvoiceAndTicketEmail(
          booking.contact_email,
          booking,
          invoiceNumber,
          agentCommission,
          agent
        );
        console.log(`📧 Email sent for booking ${booking.id}`);
      }
    } catch (emailError) {
      console.error(
        `😻Error sending email for booking ${booking.id}:`,
        emailError.message
      );
      res.status(500).json({
        success: false,
        message: "Email sending failed",
        error: emailError.message,
      });
      return;
    }

    // Kirim notifikasi ke klien melalui WebSocket (sama kayak handleNotification)
    if (typeof broadcast === "function") {
      broadcast({
        ticketId: ticket_id,
        orderId: invoiceNumber,
        transactionStatus: "TEST",
        message: `Test email sent for ticket ${ticket_id}`,
      });
    }

    res.status(200).json({
      success: true,
      message: "Email sent successfully",
      data: {
        booking: {
          id: booking.id,
          ticket_id: booking.ticket_id,
          booking_code: booking.booking_code,
          payment_status: booking.payment_status,
          payment_method: booking.payment_method,
          total_price: booking.total_price,
          contact_email: booking.contact_email,
          contact_name: booking.contact_name,
          contact_phone: booking.contact_phone,
          booking_date: booking.booking_date,
          expiration_time: booking.expiration_time,
        },
        transaction: {
          id: transaction.id,
          transaction_id: transaction.transaction_id,
          status: transaction.status,
          amount: transaction.amount,
          payment_method: transaction.payment_method,
          paid_at: transaction.paid_at,
        },
        agent: booking.Agent ? {
          id: booking.Agent.id,
          name: booking.Agent.name,
          email: booking.Agent.email,
        } : null,
        agentCommission: booking.agentCommission ? {
          id: booking.agentCommission.id,
          commission_rate: booking.agentCommission.commission_rate,
          commission_amount: booking.agentCommission.commission_amount,
          status: booking.agentCommission.status,
        } : null,
      },
    });
  } catch (error) {
    console.error("Error in testGetByTicketId:", error.message);
    console.error(error.stack);
    res.status(500).json({
      success: false,
      message: "Error processing request",
      error: error.message,
    });
  }
};

exports.createSnapToken = async (req, res) => {
  try {
    const requestId = crypto.randomUUID();
    const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
    const requestTarget = "/checkout/v1/payment";
    const body = req.body;

    const signature = generateSignature(
      body,
      requestId,
      timestamp,
      requestTarget
    );

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

    // Kirim Snap Token ke frontend
    const snapToken = response.data.response.payment.token_id;
    res.status(200).json({
      success: true,
      snapToken,
    });
  } catch (error) {
    console.error(
      "Error creating Snap Token:",
      error.response?.data || error.message
    );
    res.status(500).json({
      success: false,
      message: "Failed to create Snap Token",
      error: error.response?.data || error.message,
    });
  }
};
