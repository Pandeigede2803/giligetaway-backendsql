const MidtransClient = require('midtrans-client');

// Inisialisasi Midtrans Snap Client
const snap = new MidtransClient.Snap({
  isProduction: false, // Set to true in production
  serverKey: process.env.MIDTRANS_SERVER_KEY,
  clientKey: process.env.MIDTRANS_CLIENT_KEY,
});

// Fungsi untuk membuat transaksi di Midtrans
const createMidtransTransaction = async (transactionDetails, customerDetails, itemDetails, customField) => {
  try {
    const parameter = {
      transaction_details: transactionDetails,
      customer_details: customerDetails,
      item_details: itemDetails,
      custom_field1: customField
    };

    // Generate Midtrans token
    const transaction = await snap.createTransaction(parameter);
    return transaction.token; // Kembalikan token Midtrans
  } catch (error) {
    throw new Error('Failed to create Midtrans transaction: ' + error.message);
  }
};

module.exports = { createMidtransTransaction };
