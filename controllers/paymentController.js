const { generateMidtransToken } = require('../util/payment/generateMidtransToken');
const { createPayPalOrder,capturePayment } = require('../util/payment/paypal');
const {generateMidtransPaymentLink} = require('../util/payment/generateMidtransLink');



// MidTrans Payment Token Controller
const createMidtransTransaction = async (req, res) => {
  try {
    const bookingDetails = req.body.booking; // Assuming booking details are sent in the request body

    // Generate MidTrans transaction token
    const transactionToken = await generateMidtransToken(bookingDetails);

    // Send the transaction token back to the client
    res.status(200).json({
      success: true,
      message: 'MidTrans transaction token generated successfully',
      token: transactionToken,
    });
  } catch (error) {
    console.error('Error creating MidTrans transaction:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create MidTrans transaction',
      error: error.message,
    });
  }
};

// PayPal Payment Order Controller
const createPayPalTransaction = async (req, res) => {
    try {
      const bookingDetails = req.body.booking;
  
      // Ensure gross_total is present
      if (!bookingDetails.gross_total) {
        throw new Error('Missing gross_total in booking details');
      }
  
      // Prepare detailed PayPal order items
      const items = [
        {
          name: `Booking for ${bookingDetails.total_passengers} Passengers`, // Description of the booking
          description: `Adult: ${bookingDetails.adult_passengers}, Child: ${bookingDetails.child_passengers}, Infant: ${bookingDetails.infant_passengers}`, // Additional breakdown of passengers
          quantity: 1, // Treat the booking as one unit (a single booking)
          unit_amount: {
            currency_code: 'USD', // PayPal requires the currency
            value: bookingDetails.gross_total.toFixed(2), // Ensure the total is formatted as a string
          }
        }
      ];
  
      // Prepare PayPal order details
      const orderDetails = {
        amount: bookingDetails.gross_total.toFixed(2), // Ensure it's formatted as a string
        currency: 'USD', // or any other currency you prefer
        items, // Add the detailed items array
        returnUrl: `${process.env.BASE_URL}/complete-order`,
        cancelUrl: `${process.env.BASE_URL}/cancel-order`
      };
  
      console.log("Order Details:", orderDetails); // Log the order details for inspection
  
      // Create PayPal order and get approval link
      const { id, approvalLink } = await createPayPalOrder(orderDetails);
  
      // Send PayPal order ID and approval link to the frontend
      res.status(200).json({
        success: true,
        message: 'PayPal order created successfully',
        payment_method: 'paypal',
        order_id: id,
        approval_link: approvalLink,
      });
    } catch (error) {
      console.error('Error creating PayPal order:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create PayPal order',
        error: error.message,
      });
    }
  };
  



const createMidtransTransactionLink = async (req, res) => {
  try {
    const bookingDetails = req.body.booking;

    console.log('Booking Details:', bookingDetails);

    // Generate MidTrans payment link
    const paymentUrl = await generateMidtransPaymentLink(bookingDetails);

    // Send the payment link URL back to the client
    res.status(200).json({
      success: true,
      message: 'MidTrans payment link generated successfully',
      payment_url: paymentUrl,
    });
  } catch (error) {
    console.error('Error creating MidTrans payment link:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create MidTrans payment link',
      error: error.message,
    });
  }
};



const handlePayPalReturn = async (req, res) => {
    try {
      // Mengambil orderId atau token dari query parameters
      const orderId = req.query.token || req.query.orderId;
  
      if (!orderId) {
        throw new Error('Order ID (token) PayPal tidak ditemukan');
      }
  
      // Menangkap pembayaran menggunakan orderId
      const captureResult = await capturePayment(orderId);
  
      // Tanggapi hasil capture dari PayPal
      res.status(200).json({
        success: true,
        message: 'Pembayaran berhasil ditangkap',
        captureResult,
      });
    } catch (error) {
      console.error('Error menangani pengembalian PayPal:', error);
  
      // Kirimkan kembali seluruh error yang diterima dari PayPal jika terjadi
      if (error.details) {
        return res.status(422).json({
          success: false,
          error: error, // Pass the full error object
        });
      }
  
      // Jika error umum lainnya
      res.status(500).json({
        success: false,
        message: 'Gagal menangkap pembayaran PayPal',
        error: error.message,
      });
    }
  };
  

  
module.exports = {
  createMidtransTransaction,
  createMidtransTransactionLink,
  createPayPalTransaction,
  handlePayPalReturn
};
 