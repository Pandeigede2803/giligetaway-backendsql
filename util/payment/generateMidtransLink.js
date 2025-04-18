// utils/generateMidtransPaymentLink.js
// utils/generateMidtransPaymentLink.js
const axios = require('axios');
const base64 = require('base-64');
const fetch = require('node-fetch');
// Midtrans configuration
const midtransConfig = {
  apiBaseUrl: process.env.MIDTRANS_API_BASE_URL || 'https://api.sandbox.midtrans.com/v1/payment-links',
  serverKey: process.env.MIDTRANS_SERVER_KEY,
};

// Helper to generate a unique order ID using transaction ID and timestamp
const generateUniqueOrderId = (transactionId) => `${transactionId}-${Date.now()}`;

// Function to generate Midtrans payment link
const generateMidtransPaymentLink = async (bookingDetails, transaction) => {
  console.log("Generate MidTrans Payment Link:", bookingDetails);

  try {
    console.log("Midtrans Config:", midtransConfig);

    // Validate gross_total
    const grossTotal = parseFloat(bookingDetails.gross_total);
    if (isNaN(grossTotal)) {
      throw new Error("Invalid gross total");
    }
    console.log("Gross Total:", grossTotal);

    // Combine ticket and transport into a single item
    const combinedItemDescription = [
      `Ticket for ${bookingDetails.total_passengers} Passengers`,
      ...(bookingDetails.transports || []).map(
        (transport) => `${transport.transport_type} - ${transport.note}`
      ),
    ]
      .filter(Boolean) // Remove empty descriptions
      .join("; "); // Combine descriptions with a semicolon

    // Item details
    const itemDetails = [
      {
        id: bookingDetails.ticket_id,
        price: grossTotal, // Use gross_total as the price
        quantity: 1, // Single item for combined ticket + transport
        name: combinedItemDescription, // Combined description
      },
    ];

    console.log("Combined Item Details:", itemDetails);

    // Customer details
    const customerDetails = {
      first_name: bookingDetails.contact_name.split(" ")[0],
      last_name: bookingDetails.contact_name.split(" ").slice(1).join(" "),
      email: bookingDetails.contact_email,
      phone: bookingDetails.contact_phone,
    };

    // Generate unique order ID using the transaction ID
    const orderId = generateUniqueOrderId(transaction.transaction_id);
    console.log("Generated Unique Order ID:", orderId);

    // Transaction parameters
    const parameter = {
      transaction_details: {
        order_id: orderId,
        gross_amount: grossTotal, // Use gross_total directly
      },
      item_details: itemDetails,
      customer_details: customerDetails,
    };

    console.log("Transaction Parameters:", JSON.stringify(parameter, null, 2));

    // Headers with basic authentication
    const headers = {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Basic ${Buffer.from(`${midtransConfig.serverKey}:`).toString("base64")}`,
    };

    console.log("Authorization Header:", headers.Authorization);

    // Request to Midtrans to create the payment link
    const response = await axios.post(midtransConfig.apiBaseUrl, parameter, { headers });
    const paymentUrl = response.data.redirect_url;
    console.log(`Generated MidTrans Payment Link: ${paymentUrl}`);

    return paymentUrl;;
  } catch (error) {
    console.error("Error generating MidTrans payment link:", error);
    if (error.response) {
      console.error("Midtrans Response Error:", error.response.data);
    }
    throw new Error("Failed to generate MidTrans payment link");
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

