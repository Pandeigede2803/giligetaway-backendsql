const {
  generateMidtransToken,
  generateMidtransTokenMulti,
} = require("../util/payment/generateMidtransToken");
const { createPayPalOrder, capturePayment } = require("../util/payment/paypal");
const {
  generateMidtransPaymentLink,
  generateMidtransPaymentLinkMulti,
} = require("../util/payment/generateMidtransLink");
const base64 = require('base-64');
const fetch = require('node-fetch');

// Controller to Generate Midtrans Payment Link

// Controller to
function formatDateToMidtrans(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are 0-based in JS
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds} +0700`;
}

const handleMidtransNotification = async (req, res) => {
  try {
    const notification = req.body; // Data notifikasi dari Midtrans

    // Tampilkan data notifikasi di console untuk debugging
    console.log('Notifikasi dari Midtrans:');
    console.log('Status transaksi:', notification.transaction_status);
    console.log('Transaction ID:', notification.transaction_id);
    console.log('Order ID:', notification.order_id);
    console.log('Jumlah total:', notification.gross_amount);

    // Proses status transaksi berdasarkan `transaction_status`
    switch (notification.transaction_status) {
      case 'settlement':
        // Pembayaran berhasil
        console.log(`Transaksi dengan Order ID: ${notification.order_id} berhasil.`);
        break;
      case 'pending':
        // Pembayaran menunggu
        console.log(`Transaksi dengan Order ID: ${notification.order_id} masih menunggu.`);
        break;
      case 'cancel':
      case 'expire':
        // Pembayaran dibatalkan atau kadaluarsa
        console.log(`Transaksi dengan Order ID: ${notification.order_id} dibatalkan atau kadaluarsa.`);
        break;
      case 'deny':
        // Pembayaran ditolak
        console.log(`Transaksi dengan Order ID: ${notification.order_id} ditolak.`);
        break;
      default:
        console.log(`Status transaksi tidak dikenal: ${notification.transaction_status}`);
    }

    // Setelah diproses, kirim respons sukses ke Midtrans
    res.status(200).json({ message: 'Notifikasi diterima', transactionId: notification.transaction_id });
  } catch (error) {
    console.error('Error menangani notifikasi Midtrans:', error);
    res.status(500).json({ message: 'Terjadi kesalahan saat memproses notifikasi', error: error.message });
  }
};
const generateSingleMidtransLink = async (req, res) => {
  try {
      const { bookings, transactions, transports } = req.body;
      console.log("Bookings:", bookings);
      console.log("Transactions:", transactions);
      console.log("Transports:", transports);

      const serverKey = process.env.MIDTRANS_SERVER_KEY;
      const encodedServerKey = Buffer.from(`${serverKey}:`).toString('base64');
      console.log("Encoded Server Key:", encodedServerKey);

      // Calculate total gross amount and prepare item details by merging bookings and transports
      const itemDetails = [];
      let grossAmount = 0;

      // Add each booking's ticket as an item
      bookings.forEach((booking) => {
          const ticketItem = {
              id: booking.ticket_id,
              price: booking.ticket_total,
              quantity: booking.total_passengers,
              name: `Ticket for ${booking.total_passengers} Passengers`,
          };
          itemDetails.push(ticketItem);
          grossAmount += booking.ticket_total * booking.total_passengers;
          console.log("Added ticket item:", ticketItem);
      });

      // Add each transport as an item
      transports.forEach((transport) => {
          const transportItem = {
              id: `transport_${transport.transport_id}`,
              price: transport.transport_price,
              quantity: transport.quantity,
              name: `${transport.transport_type} - ${transport.note}`,
          };
          itemDetails.push(transportItem);
          grossAmount += transport.transport_price * transport.quantity;
          console.log("Added transport item:", transportItem);
      });

      console.log("Total Gross Amount:", grossAmount);
      console.log("Item Details:", itemDetails);

      // Use data from the first booking for customer details
      const primaryBooking = bookings[0];
      const customerDetails = {
          first_name: primaryBooking.contact_name.split(" ")[0],
          last_name: primaryBooking.contact_name.split(" ").slice(1).join(" "),
          email: primaryBooking.contact_email,
          phone: primaryBooking.contact_phone,
          nationality: primaryBooking.contact_nationality,
          passport_id: primaryBooking.contact_passport_id,
      };
      console.log("Customer Details:", customerDetails);

      // Use transaction ID from the first transaction for order_id
      const primaryTransaction = transactions[0];
      const transactionDetails = {
          order_id: `${primaryTransaction.transaction_id}`, // Unique order_id
          gross_amount: grossAmount, // Total amount based on item details
      };
      console.log("Transaction Details:", transactionDetails);

      // Format start_time
      const startTime = formatDateToMidtrans(new Date());
      console.log("Formatted Start Time:", startTime);

      // Create parameter object for Midtrans
      const parameter = {
          transaction_details: transactionDetails,
          customer_details: customerDetails,
          item_details: itemDetails,
          credit_card: {
              secure: true
          },
          expiry: {
              start_time: startTime,
              unit: "minutes",
              duration: 15, // Duration in minutes until the link expires
          }
      };
      console.log("Request Parameters:", JSON.stringify(parameter, null, 2));

      // Midtrans API URL
      const url = 'https://app.sandbox.midtrans.com/snap/v1/transactions';

      // Set up fetch options
      const options = {
          method: 'POST',
          headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
              'Authorization': `Basic ${encodedServerKey}`
          },
          body: JSON.stringify(parameter)
      };
      console.log("Fetch Options:", options);

      // Make API request to Midtrans and capture the response
      const midtransResponse = await fetch(url, options);
      const midtransData = await midtransResponse.json();

      if (midtransResponse.ok) {
          console.log("Midtrans Response Data:", midtransData);
          res.status(200).json({
              message: 'Midtrans payment link generated successfully',
              paymentUrl: midtransData.redirect_url,
          });
      } else {
          console.error('Midtrans API Error:', midtransData);
          res.status(midtransResponse.status).json({
              message: 'Failed to generate Midtrans payment link',
              error: midtransData.status_message || 'Unknown error',
              details: midtransData
          });
      }
  } catch (error) {
      console.error('Unexpected Error:', error);
      res.status(500).json({
          message: 'An unexpected error occurred while generating the Midtrans link',
          error: error.message,
      });
  }
};



// Controller to Generate Midtrans Payment Link
// Controller to Generate Midtrans Payment Link
const generateMidtransLink = async (req, res) => {
  try {
      const { booking, transaction, transports } = req.body;

      // Prepare transaction details
      const transactionDetails = {
          order_id: transaction.transaction_id,
          gross_amount: booking.gross_total,
      };

      // Prepare customer details
      const customerDetails = {
          first_name: booking.contact_name,
          email: booking.contact_email,
          phone: booking.contact_phone,
          nationality: booking.contact_nationality,
          passport_id: booking.contact_passport_id,
      };

      // Prepare item details, including transports
      const itemDetails = [
          {
              id: booking.ticket_id,
              price: booking.ticket_total,
              quantity: 1,
              name: "Ticket",
          },
          ...transports.map((transport) => ({
              id: transport.transport_id,
              price: transport.transport_price,
              quantity: transport.quantity,
              name: `${transport.transport_type} - ${transport.note}`,
          }))
      ];

      // Format start_time using helper function
      const startTime = formatDateToMidtrans(new Date());

      // Create parameter object for Midtrans
      const parameter = {
          transaction_details: transactionDetails,
          customer_details: customerDetails,
          item_details: itemDetails,
          credit_card: {
              secure: true
          },
          expiry: {
              start_time: startTime,
              unit: "minutes",
              duration: 15, // Duration in minutes until the link expires
          }
      };

      // Midtrans API URL
      const url = 'https://app.sandbox.midtrans.com/snap/v1/transactions';

      // Fetch server key from environment variable
      const serverKey = process.env.MIDTRANS_SERVER_KEY;
      const encodedServerKey = Buffer.from(`${serverKey}:`).toString('base64');

      // Set up fetch options
      const options = {
          method: 'POST',
          headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
              'Authorization': `Basic ${encodedServerKey}`
          },
          body: JSON.stringify(parameter)
      };

      // Make API request to Midtrans and capture the response
      const midtransResponse = await fetch(url, options);
      const midtransData = await midtransResponse.json();

      if (midtransResponse.ok) {
          res.status(200).json({
              message: 'Midtrans payment link generated successfully',
              paymentUrl: midtransData.redirect_url,
          });
      } else {
          console.error('Midtrans API Error:', midtransData);
          res.status(midtransResponse.status).json({
              message: 'Failed to generate Midtrans payment link',
              error: midtransData.status_message || 'Unknown error',
              details: midtransData
          });
      }
  } catch (error) {
      console.error('Unexpected Error:', error);
      res.status(500).json({
          message: 'An unexpected error occurred while generating the Midtrans link',
          error: error.message,
      });
  }
};



// MidTrans Payment Token Controller
const createMidtransTransaction = async (req, res) => {
  try {
    const { booking, transports } = req.body; // Destructure booking and transports from the request body

    // Merge transports into booking details
    const bookingDetails = { ...booking, transports }; // Add transports into bookingDetails
    console.log("bookingDetails:", bookingDetails);
    // Generate MidTrans transaction token
    const transactionToken = await generateMidtransToken(bookingDetails);

    // Send the transaction token back to the client
    res.status(200).json({
      success: true,
      message: "MidTrans transaction token generated successfully",
      token: transactionToken,
    });
  } catch (error) {
    console.error("Error creating MidTrans transaction:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create MidTrans transaction",
      error: error.message,
    });
  }
};

const createMidtransTransactionMulti = async (req, res) => {
  try {
    let { bookings, transports } = req.body; // Destructure bookings and transports from the request body

    // Jika bookings bukan array, konversi objek menjadi array
    if (!Array.isArray(bookings)) {
      bookings = Object.values(bookings); // Convert bookings object with numeric keys to array
    }

    // Gabungkan transports ke bookingDetails
    const bookingDetails = { bookings, transports }; // Keep bookings as an array and add transports

    console.log("bookingDetails:", bookingDetails);

    // Generate MidTrans transaction token
    const transactionToken = await generateMidtransTokenMulti(bookingDetails);

    // Send the transaction token back to the client
    res.status(200).json({
      success: true,
      message: "MidTrans transaction token generated successfully",
      token: transactionToken,
    });
  } catch (error) {
    console.error("Error creating MidTrans transaction:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create MidTrans transaction",
      error: error.message,
    });
  }
};

// PayPal Payment Order Controller
const createPayPalTransaction = async (req, res) => {
  try {
    console.log("1. Received booking details:", req.body.booking);

    const bookingDetails = req.body.booking;

    // Ensure gross_total is present
    if (!bookingDetails.gross_total) {
      throw new Error("Missing gross_total in booking details");
    }

    console.log("2. Calculating PayPal order items...");

    // Prepare detailed PayPal order items
    const items = [
      {
        name: `Booking for ${bookingDetails.total_passengers} Passengers`, // Description of the booking
        description: `Adult: ${bookingDetails.adult_passengers}, Child: ${bookingDetails.child_passengers}, Infant: ${bookingDetails.infant_passengers}`, // Additional breakdown of passengers
        quantity: 1, // Treat the booking as one unit (a single booking)
        unit_amount: {
          currency_code: "USD", // PayPal requires the currency
          value: bookingDetails.gross_total.toFixed(2), // Ensure the total is formatted as a string
        },
      },
    ];

    console.log("3. Preparing PayPal order details...");

    // Prepare PayPal order details
    const orderDetails = {
      amount: bookingDetails.gross_total.toFixed(2), // Ensure it's formatted as a string
      currency: "USD", // or any other currency you prefer
      items, // Add the detailed items array
      returnUrl: `${process.env.BASE_URL}/complete-order`,
      cancelUrl: `${process.env.BASE_URL}/cancel-order`,
    };

    console.log("4. Creating PayPal order...");

    // Create PayPal order and get approval link
    const { id, approvalLink } = await createPayPalOrder(orderDetails);

    console.log("5. Sending PayPal order ID and approval link to frontend...");

    // Send PayPal order ID and approval link to the frontend
    res.status(200).json({
      success: true,
      message: "PayPal order created successfully",
      payment_method: "paypal",
      order_id: id,
      approval_link: approvalLink,
    });
  } catch (error) {
    console.error("Error creating PayPal order:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create PayPal order",
      error: error.message,
    });
  }
};
// Handle PayPal return (controller function)
const handlePayPalReturn = async (req, res) => {
  console.log("1. Handling PayPal return...");

  try {
    // Extract orderId from query parameters
    const orderId = req.query.orderId; // Get orderId from query string
    console.log("2. Received order ID (token):", orderId);

    if (!orderId) {
      throw new Error("PayPal order ID (token) not found");
    }

    console.log("3. Capturing payment using the token...");
    // Capture the payment using the token (orderId)
    const captureResult = await capturePayment(orderId);
    console.log("4. Payment capture result:", captureResult);

    res.status(200).json({
      success: true,
      message: "Payment successfully captured",
      captureResult,
    });
  } catch (error) {
    console.error("Error handling PayPal return:", error);
    res.status(500).json({
      success: false,
      message: "Failed to capture PayPal payment",
      error: error.message || "Internal Server Error",
    });
  }
};

// Express controller to handle request and response
const createMidtransTransactionLink = async (req, res) => {
  try {
    const { booking, transports, transaction } = req.body; // Include transaction data

    // Merge transports into booking details
    const bookingDetails = { ...booking, transports };
    console.log("bookingDetails:", bookingDetails);

    // Generate MidTrans payment link with transaction data
    const paymentUrl = await generateMidtransPaymentLink(bookingDetails, transaction);

    // Send the payment link URL back to the client
    res.status(200).json({
      success: true,
      message: "MidTrans payment link generated successfully",
      payment_url: paymentUrl,
    });
  } catch (error) {
    console.error("Error creating MidTrans payment link:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create MidTrans payment link",
      error: error.message,
    });
  }
};


const createMidtransMulti = async (req, res) => {
  try {
    let { bookings, transports } = req.body; // Destructure booking and transports from the request body
    console.log("booking:", bookings, "transports:", transports);
    // Jika booking adalah objek dengan kunci numerik, konversi menjadi array
    if (!Array.isArray(bookings)) {
      bookings = Object.values(bookings); // Convert bookings object to array if necessary
    }

    // Gabungkan transports ke bookingDetails
    const bookingDetails = { bookings, transports }; // Add transports to bookingDetails as part of booking

    console.log("bookingDetails:", bookingDetails);

    // Generate MidTrans payment link
    const paymentUrl = await generateMidtransPaymentLinkMulti(bookingDetails);

    // Send the payment link URL back to the client
    res.status(200).json({
      success: true,
      message: "MidTrans payment link generated successfully",
      payment_url: paymentUrl,
    });
  } catch (error) {
    console.error("Error creating MidTrans payment link:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create MidTrans payment link",
      error: error.message,
    });
  }
};

module.exports = {
  createMidtransTransaction,
  createMidtransTransactionLink,
  createPayPalTransaction,
  handlePayPalReturn,
  createMidtransTransactionMulti,
  generateMidtransLink,
  createMidtransMulti,generateSingleMidtransLink,handleMidtransNotification

};
