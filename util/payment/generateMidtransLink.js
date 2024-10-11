// utils/generateMidtransPaymentLink.js
const axios = require('axios');

// Midtrans Payment Link API Configuration
const midtransConfig = {
  apiBaseUrl: 'https://api.sandbox.midtrans.com/v1/payment-links',
  serverKey: process.env.MIDTRANS_SERVER_KEY,
};

/**
 * Generate a MidTrans payment link based on booking details
 * @param {Object} bookingDetails - Booking details provided in the request body
 * @returns {Promise<String>} - MidTrans payment link URL
 */
const generateMidtransPaymentLink = async (bookingDetails) => {
  // console log
  console.log('Booking details FROM BODY:', bookingDetails);
  
  try {
    // Mengambil `ticket_total` dari bookingDetails
    const ticketTotal = parseFloat(bookingDetails.ticket_total);
    
    // Menambahkan detail tiket ke dalam item details
    const itemDetails = [
      {
        id: bookingDetails.ticket_id,
        price: ticketTotal,
        quantity: bookingDetails.total_passengers,
        name: `Ticket for ${bookingDetails.total_passengers} Passengers`,
      },
      ...(Array.isArray(bookingDetails.transports)
        ? bookingDetails.transports.map((transport) => ({
            id: `transport_${transport.transport_id}`,
            price: parseFloat(transport.transport_price),
            quantity: transport.quantity,
            name: `${transport.transport_type} - ${transport.note}`,
          }))
        : []),
    ];
    
    console.log('Item details:', itemDetails);

    // Hitung total gross amount
    const grossAmount = itemDetails.reduce((total, item) => total + item.price * item.quantity, 0);
    
    // Persiapkan customer details
    const customerDetails = {
      first_name: bookingDetails.contact_name.split(' ')[0],
      last_name: bookingDetails.contact_name.split(' ').slice(1).join(' '),
      email: bookingDetails.contact_email,
      phone: bookingDetails.contact_phone,
    };

    // Persiapkan parameter transaksi untuk MidTrans Payment Link
    const parameter = {
      transaction_details: {
        order_id: `ORDER-${Date.now()}`, // Unik order ID
        gross_amount: grossAmount,
      },
      item_details: itemDetails,
      customer_details: customerDetails,
      expiry: {
        duration: 30,
        unit: 'days',
      },
      custom_field1: `Booking on ${bookingDetails.booking_date}`,
    };

    // Request headers for Midtrans API
    const headers = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Basic ${Buffer.from(`${midtransConfig.serverKey}:`).toString('base64')}`,
    };

    // Create the payment link by sending a POST request to Midtrans
    const response = await axios.post(midtransConfig.apiBaseUrl, parameter, { headers });

    // Extract the payment URL from the response
    const paymentUrl = response.data.payment_url;
    console.log(`Generated MidTrans Payment Link: ${paymentUrl}`);

    return paymentUrl;
  } catch (error) {
    console.error('Error generating MidTrans payment link:', error.message);
    throw new Error('Failed to generate MidTrans payment link');
  }
};
module.exports={generateMidtransPaymentLink}
