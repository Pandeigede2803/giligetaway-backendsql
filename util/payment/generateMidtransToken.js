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

/**
 * Generate a MidTrans transaction token based on array of booking details
 * @param {Object} data - Contains an array of bookings and transactions
 * @returns {Promise<String>} - MidTrans transaction token
 */
const generateMidtransTokenMulti = async (data) => {
  let { bookings, transports } = data;

  // Jika 'bookings' tidak berbentuk array, konversi objek 'bookings' menjadi array, dan abaikan properti 'transports'
  if (!Array.isArray(bookings)) {
    bookings = Object.values(bookings).filter((item) => typeof item === 'object' && !Array.isArray(item)); // Hanya ambil objek booking
  }

  // Log untuk memeriksa isi bookings dan transports
  console.log('Bookings:', bookings);
  console.log('Transports:', transports);

  try {
    // Initialize an empty array to hold all item details
    let itemDetails = [];

    // Loop through each booking and add its details to itemDetails
    bookings.forEach((booking, index) => {
      const ticketTotal = parseFloat(booking.ticket_total);
      console.log(`Processing booking ${index + 1}:`, booking);
      console.log(`Ticket total for booking ${index + 1}:`, ticketTotal);

      // Add ticket details
      itemDetails.push({
        id: booking.ticket_id,
        price: ticketTotal,
        quantity: booking.total_passengers,
        name: `Ticket for ${booking.total_passengers} Passengers (Booking ID: ${booking.id})`,
      });
    });

    // Add transports to itemDetails if available
    if (Array.isArray(transports)) {
      console.log(`Adding transports:`, transports);
      transports.forEach((transport) => {
        itemDetails.push({
          id: `transport_${transport.transport_id}`,
          price: parseFloat(transport.transport_price),
          quantity: transport.quantity,
          name: `${transport.transport_type} - ${transport.note}`,
        });
      });
    }

    console.log('Item details:', itemDetails);

    // Calculate the total gross amount from all item details
    const grossAmount = itemDetails.reduce((total, item) => total + item.price * item.quantity, 0);
    console.log('Total gross amount:', grossAmount);

    // Validate and prepare customer details
    const customerDetails = {
      first_name: bookings[0].contact_name ? bookings[0].contact_name.split(' ')[0] : '',
      last_name: bookings[0].contact_name ? bookings[0].contact_name.split(' ').slice(1).join(' ') : '',
      email: bookings[0].contact_email || '',
      phone: bookings[0].contact_phone || '',
    };

    console.log('Customer details:', customerDetails);

    // Prepare the transaction parameters for MidTrans
    const parameter = {
      transaction_details: {
        order_id: `ORDER-${Date.now()}`, // Generate a unique order ID
        gross_amount: grossAmount, // Total transaction amount
      },
      item_details: itemDetails, // All item details including tickets and transports
      customer_details: customerDetails,
      custom_field1: `Multiple bookings on ${bookings[0].booking_date}`, // Use the first booking date as a reference
    };

    console.log('Transaction parameters:', parameter);

    // Generate the transaction token using MidTrans Snap API
    const transactionToken = await snap.createTransactionToken(parameter);
    console.log(`Generated MidTrans Transaction Token: ${transactionToken}`);

    return transactionToken;
  } catch (error) {
    console.error('Error generating MidTrans token:', error.message);
    throw new Error('Failed to generate MidTrans transaction token');
  }
};




module.exports = { generateMidtransToken,generateMidtransTokenMulti };
