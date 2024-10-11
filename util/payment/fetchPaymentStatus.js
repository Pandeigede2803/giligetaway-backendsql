const fetch = require('node-fetch');
const { getPaypalAccessToken } = require('./paypalToken'); // Adjust the path to your PayPal token utility

// Fetch Midtrans Payment Status
const fetchMidtransPaymentStatus = async (transactionId) => {
  const serverKey = process.env.MIDTRANS_SERVER_KEY;
  const url = `https://api.sandbox.midtrans.com/v2/${transactionId}/status`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Basic ${Buffer.from(serverKey + ':').toString('base64')}`,
      'Content-Type': 'application/json',
    },
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`Midtrans error: ${data.status_message}`);
  }

  return {
    paymentStatus: data.transaction_status,
    orderId: data.order_id,
  };
};

// Fetch PayPal Payment Status
const fetchPaypalPaymentStatus = async (transactionId) => {
  const accessToken = await getPaypalAccessToken();
  const url = `https://api-m.sandbox.paypal.com/v2/checkout/orders/${transactionId}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  const data = await response.json();
  if (!response.ok || !data || !data.purchase_units) {
    throw new Error('PayPal error: No transaction details found');
  }

  return {
    paymentStatus: data.status,
    orderId: data.id,
    paymentSource: data.payment_source,
  };
};

// Unified payment status function
const fetchPaymentStatus = async (transactionId, paymentMethod) => {
  try {
    let paymentStatusResponse;

    if (paymentMethod.toLowerCase() === 'midtrans') {
      paymentStatusResponse = await fetchMidtransPaymentStatus(transactionId);
    } else if (paymentMethod.toLowerCase() === 'paypal') {
      paymentStatusResponse = await fetchPaypalPaymentStatus(transactionId);
    } else {
      throw new Error('Invalid payment method');
    }

    return paymentStatusResponse;
  } catch (error) {
    throw new Error(`Error fetching payment status: ${error.message}`);
  }
};

module.exports = {
  fetchMidtransPaymentStatus,
  fetchPaypalPaymentStatus,
  fetchPaymentStatus, // Export unified payment status function
};
