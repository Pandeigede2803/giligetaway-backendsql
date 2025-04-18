const fetchMidtransPaymentStatus = async (transactionId) => {
  console.log(`Fetching Midtrans payment status for transaction ID: ${transactionId}`);

  const isProduction = process.env.NODE_ENV === 'production';

  const serverKey = isProduction
    ? process.env.MIDTRANS_PROD_SERVER_KEY // Production server key
    : process.env.MIDTRANS_DEV_SERVER_KEY; // Sandbox server key

  const baseUrl = isProduction
    ? 'https://api.midtrans.com/v2'
    : 'https://api.sandbox.midtrans.com/v2';

  const url = `${baseUrl}/${transactionId}/status`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Basic ${Buffer.from(serverKey + ':').toString('base64')}`,
      'Content-Type': 'application/json',
    },
  });

  const data = await response.json();

  if (!response.ok) {
    console.error(`❌ Midtrans error: ${data.status_message}`);
    throw new Error(`Midtrans error: ${data.status_message}`);
  }

  console.log(`✅ Payment status: ${data.transaction_status}`);
  console.log(`📦 Order ID: ${data.order_id}`);

  return {
    paymentStatus: data.transaction_status,
    orderId: data.order_id,
  };;
};



module.exports = {fetchMidtransPaymentStatus};

