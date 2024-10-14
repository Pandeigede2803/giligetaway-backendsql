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
        return_url: orderDetails.returnUrl,
        cancel_url: orderDetails.cancelUrl,
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


