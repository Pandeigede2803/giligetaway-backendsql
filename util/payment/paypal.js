const fetch = require('node-fetch');
const PAYPAL_API = process.env.PAYPAL_API || 'https://api-m.sandbox.paypal.com'; // Sandbox environment by default

/**
 * Generate an access token using PayPal Client ID and Secret
 * @returns {Promise<String>} - PayPal access token
 */
const generatePayPalAccessToken = async () => {
  try {
    const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT;
    const PAYPAL_SECRET = process.env.PAYPAL_SECRET;

    const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_SECRET}`).toString('base64');
    
    const response = await fetch(`${PAYPAL_API}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('Failed to generate PayPal access token:', data);
      throw new Error('Failed to generate PayPal access token');
    }

    console.log('Generated PayPal access token:', data.access_token);
    return data.access_token;
  } catch (error) {
    console.error('Error generating PayPal access token:', error);
    throw new Error('Could not generate PayPal access token');
  }
};

/**
 * Create a PayPal order
 * @param {Object} orderDetails - Object containing details for the PayPal order
 * @returns {Promise<Object>} - PayPal order ID and approval link
 */const createPayPalOrder = async (orderDetails) => {
  try {
    // Ensure the amount is a string, which PayPal API requires
    const amountString = orderDetails.amount.toString();

    // Generate PayPal access token
    const accessToken = await generatePayPalAccessToken();

    // Prepare the PayPal request body
    const requestBody = {
      intent: 'CAPTURE',
      purchase_units: [
        {
          amount: {
            currency_code: orderDetails.currency || 'USD',
            value: amountString,  // Ensure value is a string
          },
        },
      ],
    };

    console.log("PayPal Request Body:", JSON.stringify(requestBody, null, 2));

    // Make the API request to PayPal
    const response = await fetch(`${PAYPAL_API}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(requestBody),  // Ensure proper JSON formatting
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('PayPal create order failed:', data);
      throw new Error('Failed to create PayPal order');
    }

    // Extract the approval link from PayPal response
    const approvalLink = data.links.find((link) => link.rel === 'approve').href;

    console.log('Created PayPal order:', data);
    console.log('Approval link:', approvalLink);

    return {
      id: data.id,
      approvalLink,
    };
  } catch (error) {
    console.error('Error creating PayPal order:', error);
    throw new Error('Failed to create PayPal order');
  }
};

module.exports = {
  createPayPalOrder,
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


