const fetchMidtransPaymentStatus = async (transactionId) => {
  console.log(`Fetching Midtrans payment status for transaction ID: ${transactionId}`);
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
    console.error(`Midtrans error: ${data.status_message}`);
    throw new Error(`Midtrans error: ${data.status_message}`);
  }

  console.log(`Payment status: ${data.transaction_status}`);
  console.log(`Order ID: ${data.order_id}`);

  return {
    paymentStatus: data.transaction_status,
    orderId: data.order_id,
  };
};

module.exports = {fetchMidtransPaymentStatus};

