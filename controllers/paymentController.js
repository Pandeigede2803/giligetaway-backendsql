const {
  generateMidtransToken,
  generateMidtransTokenMulti,
} = require("../util/payment/generateMidtransToken");
const { createPayPalOrder, capturePayment } = require("../util/payment/paypal");
const {
  generateMidtransPaymentLink,
  generateMidtransPaymentLinkMulti,
} = require("../util/payment/generateMidtransLink");

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

const createMidtransTransactionLink = async (req, res) => {
  try {
    const { booking, transports } = req.body; // Destructure booking and transports from the request body

    // Merge transports into booking details
    const bookingDetails = { ...booking, transports }; // Add transports into bookingDetails
    console.log("bookingDetails:", bookingDetails);

    // Generate MidTrans payment link
    const paymentUrl = await generateMidtransPaymentLink(bookingDetails);

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
  createMidtransMulti

};
