const midtransClient = require('midtrans-client');

// Initialize Snap MidTrans Client
const snap = new midtransClient.Snap({
  isProduction: false, // Set to true when using in production
  serverKey: process.env.MIDTRANS_SERVER_KEY, // Make sure to set this in your environment variables
});

/**
 * Generate a MidTrans transaction token based on booking details
 * @param {Object} bookingDetails - Booking details provided in the request body
 * @returns {Promise<String>} - MidTrans transaction token
 */
const generateMidtransToken = async (bookingDetails) => {

  // console log
  console.log('Booking details FROM BODY:', bookingDetails);
  
  try {
    // Mengambil `ticket_total` dari bookingDetails
    const ticketTotal = parseFloat(bookingDetails.ticket_total);
    
    // Menambahkan detail tiket ke dalam item details
    const itemDetails = [
      {
        id: bookingDetails.ticket_id,
        price: ticketTotal, // Menggunakan ticket_total untuk tiket
        quantity: bookingDetails.total_passengers, // Jumlah penumpang
        name: `Ticket for ${bookingDetails.total_passengers} Passengers`,
      },
      ...(Array.isArray(bookingDetails.transports) // Jika ada transportasi, tambahkan ke item details
        ? bookingDetails.transports.map((transport) => ({
            id: `transport_${transport.transport_id}`,
            price: parseFloat(transport.transport_price),
            quantity: transport.quantity,
            name: `${transport.transport_type} - ${transport.note}`,
          }))
        : []), // Jika tidak ada transport, lewati
    ];
    
    console.log('Item details:', itemDetails);

    // Hitung total gross amount (jumlah dari semua item di item details)
    const grossAmount = itemDetails.reduce((total, item) => total + item.price * item.quantity, 0);
    
    // Persiapkan customer details
    const customerDetails = {
      first_name: bookingDetails.contact_name.split(' ')[0],
      last_name: bookingDetails.contact_name.split(' ').slice(1).join(' '),
      email: bookingDetails.contact_email,
      phone: bookingDetails.contact_phone,
      passenger_details: bookingDetails.passengers, // Jika dibutuhkan, tambahkan detail penumpang
    };

    // Persiapkan parameter transaksi untuk MidTrans
    const parameter = {
      transaction_details: {
        order_id: `ORDER-${Date.now()}`, // Pastikan order ID unik
        gross_amount: grossAmount, // Total transaksi dihitung dari semua item
      },
      item_details: itemDetails, // Semua detail item termasuk tiket dan transport
      customer_details: customerDetails,
      custom_field1: `Booking on ${bookingDetails.booking_date}`,
    };

    // Menghasilkan token transaksi menggunakan MidTrans Snap API
    const transactionToken = await snap.createTransactionToken(parameter);
    console.log(`Generated MidTrans Transaction Token: ${transactionToken}`);

    return transactionToken;
  } catch (error) {
    console.error('Error generating MidTrans token:', error.message);
    throw new Error('Failed to generate MidTrans transaction token');
  }
};

module.exports = { generateMidtransToken };
