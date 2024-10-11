const { generateMidtransToken } = require('../util/payment/generateMidtransToken');
const { createPayPalOrder } = require('../util/payment/paypal');

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
  
      // Prepare PayPal order details
      const orderDetails = {
        amount: bookingDetails.gross_total, // This should be a valid number
        currency: 'USD', // or any other currency you prefer
      };
  
      console.log("Order Details:", orderDetails); // Add this log to inspect the order details
  
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
  
module.exports = {
  createMidtransTransaction,
  createPayPalTransaction,
};
 