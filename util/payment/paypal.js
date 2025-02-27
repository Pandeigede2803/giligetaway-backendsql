const fetch = require('node-fetch');
const PAYPAL_API = process.env.PAYPAL_API || 'https://api-m.sandbox.paypal.com'; // Sandbox environment by default


const axios = require('axios');

/**
 * Generate an access token using PayPal Client ID and Secret
 * @returns {Promise<String>} - PayPal access token
 */
const generatePayPalAccessToken = async () => {
  try {
    const response = await axios({
      url: `${process.env.PAYPAL_API}/v1/oauth2/token`,
      method: 'post',
      data: 'grant_type=client_credentials',
      auth: {
        username: process.env.PAYPAL_CLIENT,
        password: process.env.PAYPAL_SECRET,
      },
    });

    console.log('PayPal access token response jANCUK:', response.data); // Log the response data to verify
    return response.data.access_token;
  } catch (error) {
    console.error('Error generating PayPal access token:', error.response ? error.response.data : error.message);
    throw new Error('Failed to generate PayPal access token');
  }
};

/**
 * Create a PayPal order
 * @param {Object} orderDetails - Object containing details for the PayPal order
 * @returns {Promise<Object>} - PayPal order ID and approval link
 */
const createPayPalOrder = async (orderDetails) => {
  console.log('1. Generate PayPal access token...');
  try {
    // Generate PayPal access token
    const accessToken = await generatePayPalAccessToken();

    console.log('2. Prepare the PayPal request body...');
    // Prepare the PayPal request body
    const requestBody = {
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: 'default', // Add a reference_id for clarity
          amount: {
            currency_code: orderDetails.currency || 'USD',
            value: orderDetails.amount,
            breakdown: {
              item_total: {
                currency_code: orderDetails.currency || 'USD',
                value: orderDetails.amount, // Set item_total to match the amount
              }
            }
          },
          items: orderDetails.items, // Items array is passed as is
        },
      ],
      application_context: {
        return_url: `${process.env.PAYPAL_BASE_URL}success-booking`,
        cancel_url: `${process.env.PAYPAL_BASE_URL}cancel-order`,
        shipping_preference: 'NO_SHIPPING',
        user_action: 'PAY_NOW',
        brand_name: 'Giligetaway.com',
      },
    };

    console.log('3. Make the API request to PayPal...');
    // Make the API request to PayPal
    const response = await axios({
      url: `${process.env.PAYPAL_API}/v2/checkout/orders`,
      method: 'post',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      data: requestBody,
    });

    console.log('4. Get the approval link...');
    const approvalLink = response.data.links.find(link => link.rel === 'approve').href;

    return {
      id: response.data.id,
      approvalLink,
    };
  } catch (error) {
    console.error('Error creating PayPal order:', error.response ? error.response.data : error.message);
    throw new Error('Failed to create PayPal order');
  }
};

const createPayPalOrderMulti = async (orderDetails) => {
  console.log("1. Generate PayPal access token...");
  try {
    // Generate PayPal access token
    const accessToken = await generatePayPalAccessToken();

    console.log("2. Validate and prepare PayPal request body...");

    // Validate `orderDetails` fields
    if (!orderDetails || !orderDetails.purchase_units || orderDetails.purchase_units.length === 0) {
      throw new Error("Invalid or missing purchase_units in order details.");
    }

    const purchaseUnits = orderDetails.purchase_units.map((unit) => {
      if (
        !unit.amount ||
        isNaN(unit.amount.value) ||
        parseFloat(unit.amount.value) <= 0 ||
        !unit.items ||
        !Array.isArray(unit.items) ||
        unit.items.length === 0
      ) {
        throw new Error(
          `Invalid or missing amount or items in purchase unit: ${JSON.stringify(unit)}`
        );
      }

      // Ensure the item total matches the sum of item unit amounts
      const itemTotal = unit.items
        .reduce((sum, item) => sum + parseFloat(item.unit_amount.value), 0)
        .toFixed(2);

      if (parseFloat(itemTotal) !== parseFloat(unit.amount.value)) {
        throw new Error(
          `Mismatch between amount.value (${unit.amount.value}) and item_total (${itemTotal})`
        );
      }

      return {
        reference_id: unit.reference_id || "default",
        amount: {
          currency_code: unit.amount.currency_code || "USD",
          value: unit.amount.value,
          breakdown: {
            item_total: {
              currency_code: unit.amount.currency_code || "USD",
              value: itemTotal,
            },
          },
        },
        items: unit.items,
      };
    });

    const requestBody = {
      intent: "CAPTURE", // This is the missing field
      purchase_units: purchaseUnits,
      application_context: {
        return_url: orderDetails.return_url || `${process.env.PAYPAL_BASE_URL}success-booking`,
        cancel_url: orderDetails.cancel_url || `${process.env.PAYPAL_BASE_URL}error`,
        shipping_preference: "NO_SHIPPING",
        user_action: "PAY_NOW",
        brand_name: "Giligetaway.com",
      },
    };

    console.log("3. Making API request to PayPal...");
    // Make the API request to PayPal
    const response = await axios({
      url: `${process.env.PAYPAL_API}/v2/checkout/orders`,
      method: "post",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      data: requestBody,
    });

    console.log("4. Extracting approval link...");
    const approvalLink = response.data.links.find((link) => link.rel === "approve").href;

    console.log("5. PayPal order created successfully:", response.data.id);

    return {
      id: response.data.id,
      approvalLink,
    };
  } catch (error) {
    console.error("Error creating PayPal order:", error.response ? error.response.data : error.message);
    throw new Error("Failed to create PayPal order");
  }
};



const capturePayPalMultiple = async (req, res) => {
  try {
    console.log("1. Handling PayPal order capture...");

    // Extract orderId from the request body or query parameters
    const { orderId } = req.body;
    if (!orderId) {
      throw new Error("PayPal order ID is required");
    }

    console.log("2. Capturing payment for order ID:", orderId);

    // Capture the PayPal payment
    const captureResponse = await capturePayment(orderId);
    console.log("3. Capture response received:", JSON.stringify(captureResponse, null, 2));

    // Extract relevant details from the capture response
    const purchaseUnits = captureResponse.purchase_units || [];
    if (purchaseUnits.length === 0) {
      throw new Error("No purchase units found in capture response");
    }

    // Process each purchase unit
    const processedBookings = [];
    for (const unit of purchaseUnits) {
      const referenceId = unit.reference_id || "N/A";
      const payments = unit.payments.captures || [];
      if (payments.length === 0) {
        console.log(`No payments found for purchase unit: ${referenceId}`);
        continue;
      }

      // Extract payment details
      const payment = payments[0];
      const transactionId = payment.id || "N/A";
      const status = payment.status || "N/A";
      const grossAmount = payment.amount.value || "0.00";
      const currency = payment.amount.currency_code || "N/A";

      console.log(`Processing payment for reference ID: ${referenceId}`);
      console.log(`Transaction ID: ${transactionId}`);
      console.log(`Status: ${status}`);
      console.log(`Gross Amount: ${grossAmount} ${currency}`);

      // Perform necessary post-payment processing
      const bookingUpdate = {
        referenceId,
        transactionId,
        status,
        grossAmount,
        currency,
      };

      // Add to the list of processed bookings
      processedBookings.push(bookingUpdate);

      // Example: Update booking status in the database
      await updateBookingStatus(referenceId, transactionId, status, grossAmount, currency);
    }

    console.log("4. Successfully processed all purchase units:", processedBookings);

    // Respond with processed bookings
    res.status(200).json({
      success: true,
      message: "PayPal order captured successfully",
      processedBookings,
    });
  } catch (error) {
    console.error("Error capturing PayPal order:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to capture PayPal order",
      error: error.message,
    });
  }
};


/**
 * Capture the PayPal order
 * @param {String} orderId - PayPal order ID
 * @returns {Promise<Object>} - Captured PayPal order details
 */
// Capture PayPal payment
const capturePayment = async (orderId) => {
  try {
    // Generate access token
    const accessToken = await generatePayPalAccessToken();
    console.log(`PayPal access token: ${accessToken}`);

    // Send capture request to PayPal API
    const response = await axios({
      url: `${process.env.PAYPAL_API}/v2/checkout/orders/${orderId}/capture`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    });

    return response.data;
  } catch (error) {
    console.error('Error capturing PayPal payment:', error.response ? error.response.data : error.message);

    // Return PayPal error if available
    if (error.response && error.response.data) {
      throw error.response.data;
    }

    throw new Error('Failed to capture PayPal payment');
  }
};

module.exports = {
  createPayPalOrder,
  capturePayment,
  capturePayPalMultiple,
  createPayPalOrderMulti
};


// const fetch = require('node-fetch');
// const PAYPAL_API = process.env.PAYPAL_API || 'https://api-m.sandbox.paypal.com';

// const generatePayPalAccessToken = async () => {
//   try {
//     const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT;
//     const PAYPAL_SECRET = process.env.PAYPAL_SECRET;

//     const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_SECRET}`).toString('base64');
    
//     const response = await fetch(`${PAYPAL_API}/v1/oauth2/token`, {
//       method: 'POST',
//       headers: {
//         'Authorization': `Basic ${auth}`,
//         'Content-Type': 'application/x-www-form-urlencoded',
//       },
//       body: 'grant_type=client_credentials',
//     });

//     const data = await response.json();
//     if (!response.ok) {
//       console.error('Failed to generate PayPal access token:', data);
//       throw new Error('Failed to generate PayPal access token');
//     }

//     console.log('Generated PayPal access token:', data.access_token);
//     return data.access_token;
//   } catch (error) {
//     console.error('Error generating PayPal access token:', error);
//     throw new Error('Could not generate PayPal access token');
//   }
// };

// const createPayPalOrder = async (orderDetails) => {
//   try {
//     const accessToken = await generatePayPalAccessToken();

//     const requestBody = {
//       intent: 'CAPTURE',
//       purchase_units: [
//         {
//           amount: {
//             currency_code: orderDetails.currency || 'USD',
//             value: orderDetails.amount,
//           },
//         },
//       ],
//     };

//     const response = await fetch(`${PAYPAL_API}/v2/checkout/orders`, {
//       method: 'POST',
//       headers: {
//         'Content-Type': 'application/json',
//         'Authorization': `Bearer ${accessToken}`,
//       },
//       body: JSON.stringify(requestBody),
//     });

//     const data = await response.json();
//     if (!response.ok) {
//       console.error('PayPal create order failed:', data);
//       throw new Error('Failed to create PayPal order');
//     }

//     console.log('Created PayPal order:', data);

//     return {
//       id: data.id, // Return the order ID
//     };
//   } catch (error) {
//     console.error('Error creating PayPal order:', error);
//     throw new Error('Failed to create PayPal order');
//   }
// };

// module.exports = {
//   createPayPalOrder,
// };


