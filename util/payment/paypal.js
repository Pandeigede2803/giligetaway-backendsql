const fetch = require('node-fetch');
const PAYPAL_API = process.env.PAYPAL_API || 'https://api-m.sandbox.paypal.com'; // Sandbox environment by default

/**
 * Generate an access token using PayPal Client ID and Secret
 * @returns {Promise<String>} - PayPal access token
 */
const generatePayPalAccessToken = async () => {
  try {
    const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
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
 */
const createPayPalOrder = async (orderDetails) => {
  try {
    const accessToken = await generatePayPalAccessToken();

    const requestBody = {
      intent: 'CAPTURE',
      purchase_units: [
        {
          amount: {
            currency_code: orderDetails.currency || 'USD',
            value: orderDetails.amount, // Amount to be charged
          },
        },
      ],
    };

    const response = await fetch(`${PAYPAL_API}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('PayPal create order failed:', data);
      throw new Error('Failed to create PayPal order');
    }

    const approvalLink = data.links.find((link) => link.rel === 'approve').href;

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
