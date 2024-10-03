const paypal = require('@paypal/checkout-server-sdk');

// Konfigurasi PayPal Client
const payPalEnv = new paypal.core.SandboxEnvironment(process.env.PAYPAL_CLIENT_ID, process.env.PAYPAL_SECRET);
const payPalClient = new paypal.core.PayPalHttpClient(payPalEnv);

// Fungsi untuk membuat transaksi di PayPal
const createPayPalTransaction = async (totalAmount, currency, description) => {
  try {
    const request = new paypal.orders.OrdersCreateRequest();
    request.requestBody({
      intent: 'CAPTURE',
      purchase_units: [{
        amount: {
          currency_code: currency,
          value: totalAmount.toString(),
        },
        description: description,
      }]
    });

    // Generate PayPal order
    const order = await payPalClient.execute(request);
    return order.result.id; // Kembalikan ID order PayPal
  } catch (error) {
    throw new Error('Failed to create PayPal transaction: ' + error.message);
  }
};

module.exports = { createPayPalTransaction };
