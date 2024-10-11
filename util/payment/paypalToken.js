const fetch = require('node-fetch');
const { inspect } = require('util');

// Fetch PayPal access token
const getPaypalAccessToken = async () => {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_SECRET;
  const auth = Buffer.from(`${clientId}:${secret}`).toString('base64');

  console.log('Fetching PayPal access token...');
  const response = await fetch('https://api-m.sandbox.paypal.com/v1/oauth2/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  console.log(`PayPal access token response: ${inspect(response)}`);
  const data = await response.json();

  if (data.error) {
    throw new Error(`PayPal access token error: ${data.error_description}`);
  }

  console.log(`PayPal access token: ${inspect(data.access_token)}`);
  return data.access_token;
};

// Export the function
module.exports = { getPaypalAccessToken };
