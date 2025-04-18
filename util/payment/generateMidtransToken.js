const midtransClient = require('midtrans-client');

// Initialize Snap MidTrans Client
// const isProduction = process.env.IS_PRODUCTION === 'false';

// Deteksi environment production atau dev
const isProduction = process.env.NODE_ENV === 'production';

// Pilih server key berdasarkan environment
// const serverKey = isProduction
//   ? process.env.MIDTRANS_PROD_SERVER_KEY
//   : process.env.MIDTRANS_DEV_SERVER_KEY;

// Use the corresponding server key based on the environment
const serverKey = isProduction
  ? process.env.MIDTRANS_PROD_SERVER_KEY // Production server key
  : process.env.MIDTRANS_DEV_SERVER_KEY; // Development server key

// Initialize Snap instance
const snap = new midtransClient.Snap({
  isProduction,
  serverKey,
});

const generateMidtransToken = async (bookingDetails,transactionId) => {
  console.log("Booking details FROM BODY:", bookingDetails);
  console.log("🙀Transaction ID:", transactionId);

  try {
    // Mengambil `ticket_total` dari bookingDetails
    const ticketTotal = parseFloat(bookingDetails.gross_total
    );

    // Gabungkan deskripsi tiket
    const ticketDescription = `Ticket for ${bookingDetails.total_passengers} Passengers`;

    // Gabungkan deskripsi transportasi
    const transportDescriptions = Array.isArray(bookingDetails.transports)
      ? bookingDetails.transports.map(
          (transport) =>
            `${transport.transport_type}  x ${transport.quantity}`
        ).join(", ") // Gabungkan deskripsi transport
      : "";

    // Gabungkan deskripsi tiket dan transportasi
    const combinedDescription = [ticketDescription, transportDescriptions]
      .filter(Boolean) // Hapus nilai kosong
      .join("; "); // Gabungkan dengan pemisah "; "

    // Hitung gross amount langsung dari tiket dan transportasi
    const transportTotal = Array.isArray(bookingDetails.transports)
      ? bookingDetails.transports.reduce(
          (total, transport) =>
            total + parseFloat(transport.transport_price) * transport.quantity,
          0
        )
      : 0;

    const grossAmount = bookingDetails.gross_total;

    console.log("Combined description:", combinedDescription);
    console.log("Gross amount:", grossAmount);

    // Persiapkan customer details
    const customerDetails = {
      first_name: bookingDetails.contact_name.split(" ")[0],
      last_name: bookingDetails.contact_name.split(" ").slice(1).join(" "),
      email: bookingDetails.contact_email,
      phone: bookingDetails.contact_phone,
      passenger_details: bookingDetails.passengers, // Jika dibutuhkan, tambahkan detail penumpang
    };

    const uniqueSuffix = Date.now(); // atau bisa nanoid/uuid pendek
    // Persiapkan parameter transaksi untuk MidTrans
    const parameter = {
      transaction_details: {
        order_id : `${transactionId}-${uniqueSuffix}`,
        gross_amount: grossAmount, // Total transaksi dihitung langsung
      },
      item_details: [
        {
          id: "combined_items", // ID gabungan
          price: grossAmount, // Total harga
          quantity: 1, // Selalu 1
          name: combinedDescription, // Gabungan deskripsi
        },
      ],
      customer_details: customerDetails,
      custom_field1: `Booking on ${bookingDetails.booking_date}`,
    };

    console.log("Parameter transaksi ke MidTrans:", parameter);

    // Menghasilkan token transaksi menggunakan MidTrans Snap API
    const transactionToken = await snap.createTransactionToken(parameter);
    console.log(`Generated MidTrans Transaction Token: ${transactionToken}`);

    return transactionToken;
  } catch (error) {
    console.error("Error generating MidTrans token:", error.message);
    throw new Error("Failed to generate MidTrans transaction token");
  }
};


// Generate a MidTrans transaction token for multiple bookings

const MAX_NAME_LENGTH = 50; // MidTrans max name length

// Utility function to truncate item names
const truncateString = (str, maxLength) => {
  return str.length > maxLength ? `${str.substring(0, maxLength - 3)}...` : str;
};

const generateMidtransTokenMulti = async (data,transactions) => {
  try {
    let { bookings, transports } = data;

   

    const transactionIdFirst = transactions[0].transaction_id;
    console.log("😼Transaction ID:", transactionIdFirst);

    // Ensure bookings and transports are arrays
    if (!Array.isArray(bookings)) {
      bookings = Object.values(bookings).filter(
        (item) => typeof item === "object" && !Array.isArray(item)
      );
    }
    if (!Array.isArray(transports)) {
      transports = [];
    }

    // Map bookings into item details
    const itemDetails = bookings.map((booking, index) => {
      const transport = transports[index]; // Match transport to booking by index (if exists)

      // Generate description for the booking and transport
      const bookingDescription = `Booking ID: ${booking.id}, ticket for ${booking.total_passengers} Passengers`;
      const transportDescription = transport
        ? `${transport.transport_type}`
        : "";

      const combinedDescription = [bookingDescription, transportDescription]
        .filter(Boolean) // Remove empty strings
        .join("; ");

      // Truncate the combined description to adhere to MidTrans limits
      const truncatedDescription = truncateString(combinedDescription, MAX_NAME_LENGTH);

      // Use the provided gross_total for price
      const price = parseFloat(booking.gross_total);

      return {
        id: `booking_${booking.id}`, // Unique ID for each booking
        price,
        quantity: 1, // Each booking + transport combination is one item
        name: truncatedDescription,
      };
    });

    // Calculate total gross amount (sum of all item prices)
    const totalGrossAmount = itemDetails.reduce((total, item) => total + item.price, 0);

    // Use the first booking's details for customer information
    const customerDetails = {
      first_name: bookings[0]?.contact_name.split(" ")[0] || "",
      last_name: bookings[0]?.contact_name.split(" ").slice(1).join(" ") || "",
      email: bookings[0]?.contact_email || "",
      phone: bookings[0]?.contact_phone || "",
    };

    // Prepare transaction parameters for MidTrans
     const uniqueSuffix = Date.now(); // atau bisa nanoid/uuid pendek
    const parameter = {
      transaction_details: {
        order_id : `${transactionIdFirst}-${uniqueSuffix}`,
        gross_amount: totalGrossAmount,
      },
      item_details: itemDetails, // Use generated itemDetails array
      customer_details: customerDetails,
      custom_field1: `Multiple bookings on ${bookings[0]?.booking_date || "N/A"}`,
    };

    console.log("===Transaction parameters:===", parameter);

    // Generate transaction token using MidTrans Snap API
    const transactionToken = await snap.createTransactionToken(parameter);
    console.log(`Generated MidTrans Transaction Token: ${transactionToken}`);

    return transactionToken;
  } catch (error) {
    console.error("Error generating MidTrans token:", error.message);
    throw new Error("Failed to generate MidTrans transaction token");
  }
};





module.exports = { generateMidtransToken,generateMidtransTokenMulti };



/**
 * Generate a MidTrans transaction token based on booking details
 * @param {Object} bookingDetails - Booking details provided in the request body
 * @returns {Promise<String>} - MidTrans transaction token
 */
// const generateMidtransToken = async (bookingDetails) => {

//   // console log
//   console.log('Booking details FROM BODY:', bookingDetails);
  
//   try {
//     // Mengambil `ticket_total` dari bookingDetails
//     const ticketTotal = parseFloat(bookingDetails.ticket_total);
    
//     // Menambahkan detail tiket ke dalam item details
//     const itemDetails = [
//       {
//         id: bookingDetails.ticket_id,
//         price: ticketTotal, // Menggunakan ticket_total untuk tiket
//         quantity: bookingDetails.total_passengers, // Jumlah penumpang
//         name: `Ticket for ${bookingDetails.total_passengers} Passengers`,
//       },
//       ...(Array.isArray(bookingDetails.transports) // Jika ada transportasi, tambahkan ke item details
//         ? bookingDetails.transports.map((transport) => ({
//             id: `transport_${transport.transport_id}`,
//             price: parseFloat(transport.transport_price),
//             quantity: transport.quantity,
//             name: `${transport.transport_type} - ${transport.note}`,
//           }))
//         : []), // Jika tidak ada transport, lewati
//     ];
    
//     console.log('Item details:', itemDetails);

//     // Hitung total gross amount (jumlah dari semua item di item details)
//     const grossAmount = itemDetails.reduce((total, item) => total + item.price * item.quantity, 0);
    
//     // Persiapkan customer details
//     const customerDetails = {
//       first_name: bookingDetails.contact_name.split(' ')[0],
//       last_name: bookingDetails.contact_name.split(' ').slice(1).join(' '),
//       email: bookingDetails.contact_email,
//       phone: bookingDetails.contact_phone,
//       passenger_details: bookingDetails.passengers, // Jika dibutuhkan, tambahkan detail penumpang
//     };

//     // Persiapkan parameter transaksi untuk MidTrans
//     const parameter = {
//       transaction_details: {
//         order_id: `ORDER-${Date.now()}`, // Pastikan order ID unik
//         gross_amount: grossAmount, // Total transaksi dihitung dari semua item
//       },
//       item_details: itemDetails, // Semua detail item termasuk tiket dan transport
//       customer_details: customerDetails,
//       custom_field1: `Booking on ${bookingDetails.booking_date}`,
//     };

//     // Menghasilkan token transaksi menggunakan MidTrans Snap API
//     const transactionToken = await snap.createTransactionToken(parameter);
//     console.log(`Generated MidTrans Transaction Token: ${transactionToken}`);

//     return transactionToken;
//   } catch (error) {
//     console.error('Error generating MidTrans token:', error.message);
//     throw new Error('Failed to generate MidTrans transaction token');
//   }
// };

/**
 * Generate a MidTrans transaction token based on array of booking details
 * @param {Object} data - Contains an array of bookings and transactions
 * @returns {Promise<String>} - MidTrans transaction token
 */
// const generateMidtransTokenMulti = async (data) => {
//   let { bookings, transports } = data;

//   // Jika 'bookings' tidak berbentuk array, konversi objek 'bookings' menjadi array, dan abaikan properti 'transports'
//   if (!Array.isArray(bookings)) {
//     bookings = Object.values(bookings).filter((item) => typeof item === 'object' && !Array.isArray(item)); // Hanya ambil objek booking
//   }

//   // Log untuk memeriksa isi bookings dan transports
//   console.log('Bookings:', bookings);
//   console.log('Transports:', transports);

//   try {
//     // Initialize an empty array to hold all item details
//     let itemDetails = [];

//     // Loop through each booking and add its details to itemDetails
//     bookings.forEach((booking, index) => {
//       const ticketTotal = parseFloat(booking.ticket_total);
//       console.log(`Processing booking ${index + 1}:`, booking);
//       console.log(`Ticket total for booking ${index + 1}:`, ticketTotal);

//       // Add ticket details
//       itemDetails.push({
//         id: booking.ticket_id,
//         price: ticketTotal,
//         quantity: booking.total_passengers,
//         name: `Ticket for ${booking.total_passengers} Passengers (Booking ID: ${booking.id})`,
//       });
//     });

//     // Add transports to itemDetails if available
//     if (Array.isArray(transports)) {
//       console.log(`Adding transports:`, transports);
//       transports.forEach((transport) => {
//         itemDetails.push({
//           id: `transport_${transport.transport_id}`,
//           price: parseFloat(transport.transport_price),
//           quantity: transport.quantity,
//           name: `${transport.transport_type} - ${transport.note}`,
//         });
//       });
//     }

//     console.log('Item details:', itemDetails);

//     // Calculate the total gross amount from all item details
//     // const grossAmount = itemDetails.reduce((total, item) => total + item.price * item.quantity, 0);
//     // console.log('Total gross amount:', grossAmount);

//     // Hitung total gross dari semua bookings
//     const totalGrossAmount = bookings.reduce(
//       (total, booking) => total + parseFloat(booking.gross_total),
//       0
//     );
//     // Validate and prepare customer details
//     const customerDetails = {
//       first_name: bookings[0].contact_name ? bookings[0].contact_name.split(' ')[0] : '',
//       last_name: bookings[0].contact_name ? bookings[0].contact_name.split(' ').slice(1).join(' ') : '',
//       email: bookings[0].contact_email || '',
//       phone: bookings[0].contact_phone || '',
//     };

//     console.log('Customer details:', customerDetails);

//     // Prepare the transaction parameters for MidTrans
//     const parameter = {
//       transaction_details: {
//         order_id: `ORDER-${Date.now()}`, // Generate a unique order ID
//         gross_amount: totalGrossAmount, // Total transaction amount
//       },
//       item_details: itemDetails, // All item details including tickets and transports
//       customer_details: customerDetails,
//       custom_field1: `Multiple bookings on ${bookings[0].booking_date}`, // Use the first booking date as a reference
//     };

//     console.log('Transaction parameters:', parameter);

//     // Generate the transaction token using MidTrans Snap API
//     const transactionToken = await snap.createTransactionToken(parameter);
//     console.log(`Generated MidTrans Transaction Token: ${transactionToken}`);

//     return transactionToken;
//   } catch (error) {
//     console.error('Error generating MidTrans token:', error.message);
//     throw new Error('Failed to generate MidTrans transaction token');
//   }
// };


