// utils/generateMidtransPaymentLink.js
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
  console.log('Generate MidTrans Payment Link:', bookingDetails);
  
  try {
    // Extract `ticket_total` from bookingDetails
    const ticketTotal = parseFloat(bookingDetails.ticket_total);
    console.log('Ticket Total:', ticketTotal);

    // Prepare item details for tickets
    const itemDetails = [
      {
        id: bookingDetails.ticket_id,
        price: ticketTotal,
        quantity: bookingDetails.total_passengers,
        name: `Ticket for ${bookingDetails.total_passengers} Passengers`,
      }
    ];

    // Add transport details if available
    if (Array.isArray(bookingDetails.transports)) {
      bookingDetails.transports.forEach((transport) => {
        console.log(`Adding transport: ${transport.transport_type} - ${transport.note}, Price: ${transport.transport_price}, Quantity: ${transport.quantity}`);
        itemDetails.push({
          id: `transport_${transport.transport_id}`,
          price: parseFloat(transport.transport_price),
          quantity: transport.quantity,
          name: `${transport.transport_type} - ${transport.note}`,
        });
      });
    } else {
      console.log('No transports available.');
    }

    console.log('Item details:', itemDetails);

    // Calculate the total gross amount
    const grossAmount = itemDetails.reduce((total, item) => {
      console.log(`Adding item: ${item.name}, Price: ${item.price}, Quantity: ${item.quantity}`);
      return total + item.price * item.quantity;
    }, 0);

    console.log('Gross Amount:', grossAmount);

    // Prepare customer details
    const customerDetails = {
      first_name: bookingDetails.contact_name ? bookingDetails.contact_name.split(' ')[0] : '',
      last_name: bookingDetails.contact_name ? bookingDetails.contact_name.split(' ').slice(1).join(' ') : '',
      email: bookingDetails.contact_email || '',
      phone: bookingDetails.contact_phone || '',
    };

    console.log('Customer Details:', customerDetails);

    // Prepare transaction parameters for MidTrans Payment Link
    const parameter = {
      transaction_details: {
        order_id: `ORDER-${Date.now()}`, // Unique order ID
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

    console.log('Transaction Parameters:', parameter);

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

const generateMidtransPaymentLinkMulti = async (data) => {
  console.log('Generate MidTrans Payment Link:', data);
  
  try {
    const { bookings, transports } = data;

    // Initialize an empty array to hold all item details
    let itemDetails = [];

    // Loop through each booking and add its details to itemDetails
    bookings.forEach((booking, index) => {
      const ticketTotal = parseFloat(booking.ticket_total);

      console.log(`Processing booking ${index + 1}: Ticket total - ${ticketTotal}, Booking ID - ${booking.id}`);

      // Add ticket details for each booking
      itemDetails.push({
        id: booking.ticket_id,
        price: ticketTotal,
        quantity: booking.total_passengers,
        name: `Ticket for ${booking.total_passengers} Passengers (Booking ID: ${booking.id})`,
      });
    });

    // Only add transports once
    if (Array.isArray(transports)) {
      console.log(`Adding global transports`);
      transports.forEach((transport) => {
        console.log(`Adding transport: ${transport.transport_type} - ${transport.note}, Price: ${transport.transport_price}, Quantity: ${transport.quantity}`);
        itemDetails.push({
          id: `transport_${transport.transport_id}`,
          price: parseFloat(transport.transport_price),
          quantity: transport.quantity,
          name: `${transport.transport_type} - ${transport.note}`,
        });
      });
    } else {
      console.log('No global transports found.');
    }

    console.log('Final Item details:', itemDetails);

    // Calculate the total gross amount
    const grossAmount = itemDetails.reduce((total, item) => {
      console.log(`Calculating total for item: ${item.name}, Price: ${item.price}, Quantity: ${item.quantity}`);
      return total + item.price * item.quantity;
    }, 0);

    console.log('Total Gross Amount:', grossAmount);

    // Assume all bookings have the same contact details for simplicity
    const customerDetails = {
      first_name: bookings[0].contact_name.split(' ')[0],
      last_name: bookings[0].contact_name.split(' ').slice(1).join(' '),
      email: bookings[0].contact_email,
      phone: bookings[0].contact_phone,
    };

    console.log('Customer Details:', customerDetails);

    // Prepare transaction parameters for MidTrans Payment Link
    const parameter = {
      transaction_details: {
        order_id: `ORDER-${Date.now()}`, // Unique order ID
        gross_amount: grossAmount,
      },
      item_details: itemDetails,
      customer_details: customerDetails,
      expiry: {
        duration: 30,
        unit: 'days',
      },
      custom_field1: `Multiple bookings on ${bookings[0].booking_date}`, // Use the first booking date as a reference
    };

    console.log('Transaction Parameters:', parameter);

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



module.exports = { generateMidtransPaymentLinkMulti, generateMidtransPaymentLink };

