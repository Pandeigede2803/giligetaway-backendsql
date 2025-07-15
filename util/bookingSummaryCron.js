const cron = require("node-cron");
const nodemailer = require("nodemailer");
const Booking = require("../models/booking");
const { Op } = require("sequelize");
const moment = require("moment");

/**
 * Cron job untuk mengirim rangkuman booking harian
 * Dijalankan setiap hari pada pukul 1 pagi
 * Berisi informasi booking yang dibuat pada hari sebelumnya dengan status "paid"
 */

// Konfigurasi email transporter
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST_BREVO, // SMTP Server (e.g., smtp.gmail.com)
  port: 587, // Use port 465 for SSL
  secure: false, // Use SSL
  auth: {
    user: process.env.EMAIL_LOGIN_BREVO, // Your email
    pass: process.env.EMAIL_PASS_BREVO, // Your email password or app password
  },
});

/**
 * Fungsi untuk mengambil data booking hari sebelumnya dengan status "paid"
 * @returns {Array} Array of booking objects
 */
const getYesterdayPaidBookings = async () => {
  // Menentukan rentang tanggal untuk hari sebelumnya (kemarin)
  const yesterday = moment().subtract(1, "days").startOf("day");
  const today = moment().startOf("day");

  try {
    const paidBookings = await Booking.findAll({
      where: {
        payment_status: {
          [Op.in]: ["paid", "invoiced"]
        },
        created_at: {
          [Op.gte]: yesterday.toDate(),
          [Op.lt]: today.toDate(),
        },
        booking_source: {
          [Op.in]: ['website', 'agent', 'staff'] // Only include website and agent bookings
        }
      },
      attributes: [
        'id', 
        'contact_name', 
        'contact_phone', 
        'contact_email',
        'gross_total',
        'currency',
        'total_passengers',
        'adult_passengers',
        'child_passengers',
        'infant_passengers',
        'booking_source',
        'booking_date',
        'ticket_id',
        'created_at',
        'final_state',"booked_by" // Include booked_by field
      ],
      order: [["created_at", "ASC"]],
    });

    return paidBookings;
  } catch (error) {
    console.error("❌ Error fetching yesterday's paid bookings:", error);
    throw error;
  }
};

/**
 * Fungsi untuk memformat data booking menjadi text sederhana
 * @param {Array} bookings Array of booking objects
 * @returns {String} Formatted text string
 */
const formatBookingsToHtmlTable = (bookings) => {
  if (!bookings || bookings.length === 0) {
    return "No paid bookings were created yesterday.";
  }

  const totalAmount = bookings.reduce((sum, booking) => sum + parseFloat(booking.gross_total), 0);
  const totalBookings = bookings.length;
  const totalPassengers = bookings.reduce((sum, booking) => sum + booking.total_passengers, 0);
  
  // Format date for the summary
  const yesterdayDate = moment().subtract(1, "days").format("MMMM D, YYYY");
  
  // Create summary text
  let emailText = `TESTING DAILY BOOKING SUMMARY - ${yesterdayDate}\n\n`;
  emailText += `SUMMARY:\n`;
  emailText += `Total Bookings: ${totalBookings}\n`;
  emailText += `Total Passengers: ${totalPassengers}\n`;
  emailText += `Total Revenue: ${totalAmount.toLocaleString()} ${bookings[0].currency || 'IDR'}\n\n`;
  
  emailText += `BOOKING DETAILS:\n\n`;
  
  // Add each booking as a simple text entry
  bookings.forEach((booking, index) => {
    emailText += `${index + 1}. Booking ID: ${booking.id}\n`;
    emailText += `   Ticket ID: ${booking.ticket_id}\n`;
    emailText += `   Contact: ${booking.contact_name}\n`;
    emailText += `   Phone: ${booking.contact_phone}\n`;
    emailText += `   Email: ${booking.contact_email}\n`;
    emailText += `   Passengers: ${booking.total_passengers} (Adults: ${booking.adult_passengers}, Children: ${booking.child_passengers}, Infants: ${booking.infant_passengers})\n`;
    emailText += `   Amount: ${parseFloat(booking.gross_total).toLocaleString()} ${booking.currency || 'IDR'}\n`;
    emailText += `   Booking Source: ${booking.booking_source || 'N/A'}\n`;
    emailText += `   Booking Date: ${moment(booking.booking_date).format("MMM D, YYYY")}\n`;
    emailText += `   Created: ${moment(booking.created_at).format("MMM D, YYYY h:mm A")}\n\n`;
  });
  
  return emailText;
};

// const formatBookingsToText = (bookings) => {
//   if (!bookings || bookings.length === 0) {
//     return "No paid bookings were created yesterday.";
//   }

//   const totalAmount = bookings.reduce((sum, booking) => sum + parseFloat(booking.gross_total || 0), 0);
//   const totalBookings = bookings.length;
//   const totalPassengers = bookings.reduce((sum, booking) => sum + (booking.total_passengers || 0), 0);

  
//   // Format date for the summary
//   const yesterdayDate = moment().subtract(1, "days").format("MMMM D, YYYY");
  
//   // Create summary text
//   let emailText = `DAILY BOOKING SUMMARY - ${yesterdayDate}\n\n`;
//   emailText += `SUMMARY:\n`;
//   emailText += `Total Bookings: ${totalBookings}\n`;
//   emailText += `Total Passengers: ${totalPassengers}\n`;
//   emailText += `Total Revenue: ${totalAmount.toLocaleString()} ${bookings[0]?.currency || 'IDR'}\n\n`;
  
//   emailText += `BOOKING DETAILS:\n\n`;
  
//   // Add each booking as a simple text entry
//   bookings.forEach((booking, index) => {
//     emailText += `${index + 1}. Booking ID: ${booking.id}\n`;
//     emailText += `   Ticket ID: ${booking.ticket_id}\n`;
//     emailText += `   Contact: ${booking.contact_name}\n`;
//     emailText += `   Phone: ${booking.contact_phone}\n`;
//     emailText += `   Email: ${booking.contact_email}\n`;
//     // route
//     emailText += `   Route: ${booking.final_state.bookingData.from||'N/A'} - ${booking.final_state.bookingData.to|| 'N/A'}\n`;
//     emailText += `   Passengers: ${booking.total_passengers} (Adults: ${booking.adult_passengers}, Children: ${booking.child_passengers}, Infants: ${booking.infant_passengers})\n`;
//     emailText += `   Amount: ${parseFloat(booking.gross_total || 0).toLocaleString()} ${booking.currency || 'IDR'}\n`;
//     emailText += `   Booking Source: ${booking.booking_source || 'N/A'}\n`;
//     emailText += `   Travel Date: ${moment(booking.booking_date).format("MMM D, YYYY")}\n`;
//     emailText += `   Created: ${moment(booking.created_at).format("MMM D, YYYY h:mm A")}\n\n`;
//     // add link for giligetaway-widget/check-ticket/${ticket_id}
//     emailText += `   Check Ticket: https://giligetaway-widget.my.id/check-ticket/${booking.ticket_id}\n\n`;
//   });
  
//   return emailText;
// };

const formatBookingsToHTML = (bookings) => {
  if (!bookings || bookings.length === 0) {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center;">
          <h2 style="color: #6c757d; margin: 0;">No paid bookings were created yesterday.</h2>
        </div>
      </div>
    `;
  }

  const yesterdayDate = moment().subtract(1, "days").format("MMMM D, YYYY");
  
  const grouped = {
    website: [],
    agent: [],
    staff: []
  };

  bookings.forEach((b) => {
    const source = b.booking_source || 'unknown';
    if (grouped[source]) {
      grouped[source].push(b);
    }
  });

  let htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 900px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
      <div style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); overflow: hidden;">
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 24px; text-align: center;">
          <h1 style="margin: 0; font-size: 24px; font-weight: 600;">📊 DAILY BOOKING SUMMARY</h1>
          <p style="margin: 8px 0 0 0; font-size: 16px; opacity: 0.9;">${yesterdayDate}</p>
        </div>
        
        <div style="padding: 24px;">
  `;

  for (const [source, entries] of Object.entries(grouped)) {
    if (entries.length === 0) continue;

    const totalAmount = entries.reduce((sum, b) => sum + parseFloat(b.gross_total || 0), 0);
    const totalBookings = entries.length;
    const totalPassengers = entries.reduce((sum, b) => sum + (b.total_passengers || 0), 0);

    // Source section header
    const sourceColors = {
      website: '#28a745',
      agent: '#007bff', 
      staff: '#ffc107'
    };
    
    const sourceIcons = {
      website: '🌐',
      agent: '👥',
      staff: '👨‍💼'
    };

    htmlContent += `
      <div style="margin-bottom: 32px;">
        <div style="background-color: ${sourceColors[source] || '#6c757d'}; color: white; padding: 16px; border-radius: 8px 8px 0 0; display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 18px;">${sourceIcons[source] || '📋'}</span>
          <h2 style="margin: 0; font-size: 18px; font-weight: 600;">${source.toUpperCase()} BOOKINGS</h2>
        </div>
        
        <!-- Summary Stats -->
        <div style="background-color: #f8f9fa; padding: 16px; border: 1px solid #e9ecef; display: flex; justify-content: space-around; text-align: center; flex-wrap: wrap; gap: 16px;">
          <div>
            <div style="font-size: 24px; font-weight: bold; color: #495057;">${totalBookings}</div>
            <div style="font-size: 14px; color: #6c757d;">Bookings</div>
          </div>
          <div>
            <div style="font-size: 24px; font-weight: bold; color: #495057;">${totalPassengers}</div>
            <div style="font-size: 14px; color: #6c757d;">Passengers</div>
          </div>
          <div>
            <div style="font-size: 24px; font-weight: bold; color: #28a745;">${totalAmount.toLocaleString()}</div>
            <div style="font-size: 14px; color: #6c757d;">${entries[0]?.currency || 'IDR'}</div>
          </div>
        </div>
        
        <!-- Booking Details -->
        <div style="background-color: white; border: 1px solid #e9ecef; border-top: none; border-radius: 0 0 8px 8px;">
    `;

    entries.forEach((booking, index) => {
      htmlContent += `
        <div style="padding: 20px; border-bottom: ${index === entries.length - 1 ? 'none' : '1px solid #e9ecef'};">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <div style="background-color: #e9ecef; color: #495057; padding: 4px 12px; border-radius: 20px; font-size: 14px; font-weight: 500;">
              #${index + 1}
            </div>
            <div style="font-size: 18px; font-weight: bold; color: #28a745;">
              ${parseFloat(booking.gross_total || 0).toLocaleString()} ${booking.currency || 'IDR'}
            </div>
          </div>
          
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 16px; margin-bottom: 16px;">
            <div>
              <div style="font-size: 12px; color: #6c757d; text-transform: uppercase; font-weight: 500; margin-bottom: 4px;">Booking Details</div>
              <div style="font-size: 14px; color: #495057; line-height: 1.5;">
                <strong>ID:</strong> ${booking.id}<br>
                <strong>Ticket:</strong> ${booking.ticket_id}<br>
                <strong>Source:</strong> ${booking.booking_source || 'N/A'}
              </div>
            </div>
            
            <div>
              <div style="font-size: 12px; color: #6c757d; text-transform: uppercase; font-weight: 500; margin-bottom: 4px;">Contact Information</div>
              <div style="font-size: 14px; color: #495057; line-height: 1.5;">
                <strong>Name:</strong> ${booking.contact_name}<br>
                <strong>Phone:</strong> ${booking.contact_phone}<br>
                <strong>Email:</strong> ${booking.contact_email}
              </div>
            </div>
            
            <div>
              <div style="font-size: 12px; color: #6c757d; text-transform: uppercase; font-weight: 500; margin-bottom: 4px;">Travel Details</div>
              <div style="font-size: 14px; color: #495057; line-height: 1.5;">
                <strong>Route:</strong> ${booking.final_state.bookingData?.from || 'N/A'} → ${booking.final_state.bookingData?.to || 'N/A'}<br>
                <strong>Travel Date:</strong> ${moment(booking.booking_date).format("MMM D, YYYY")}<br>
                <strong>Created:</strong> ${moment(booking.created_at).format("MMM D, YYYY h:mm A")}
              </div>
            </div>
            
            <div>
              <div style="font-size: 12px; color: #6c757d; text-transform: uppercase; font-weight: 500; margin-bottom: 4px;">Passengers</div>
              <div style="font-size: 14px; color: #495057; line-height: 1.5;">
                <strong>Total:</strong> ${booking.total_passengers}<br>
                <strong>Adults:</strong> ${booking.adult_passengers} | <strong>Children:</strong> ${booking.child_passengers} | <strong>Infants:</strong> ${booking.infant_passengers}
              </div>
            </div>
          </div>
          
          <div style="text-align: center; margin-top: 16px;">
            <a href="https://giligetaway-widget.my.id/check-ticket/${booking.ticket_id}" 
               style="background-color: #007bff; color: white; padding: 8px 16px; text-decoration: none; border-radius: 4px; font-size: 14px; font-weight: 500; display: inline-block;">
              🎫 Check Ticket
            </a>
          </div>
        </div>
      `;
    });

    htmlContent += `
        </div>
      </div>
    `;
  }

  htmlContent += `
        </div>
      </div>
    </div>
  `;

  return htmlContent;
};

// Alternative: Text version with improved formatting
const formatBookingsToText = (bookings) => {
  if (!bookings || bookings.length === 0) {
    return "No paid bookings were created yesterday.";
  }

  const yesterdayDate = moment().subtract(1, "days").format("MMMM D, YYYY");
  let emailText = `
╔═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════╗
║                                        📊 DAILY BOOKING SUMMARY                                                   ║
║                                              ${yesterdayDate}                                                    ║
╚═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════╝

`;

  const grouped = {
    website: [],
    agent: [],
    staff: []
  };

  bookings.forEach((b) => {
    const source = b.booking_source || 'unknown';
    if (grouped[source]) {
      grouped[source].push(b);
    }
  });
  // console log the first booking
  console.log("First booking for debugging:", bookings[0].final_state.bookingData);

//   {
//     "note": "",
//     "agentId": "",
//     "bank_fee": 32000,
//     "bookedBy": "",
//     "order_Id": "GG-OW-104157",
//     "tripType": "One Way Trip",
//     "pickupTime": "08:15",
//     "bookingData": {
//         "id": 113,
//         "to": "Gili Trawangan",
//         "from": "Serangan, Bali",
//         "toId": 2,
//         "price": "800000.00",
//         "fromId": 8,
//         "transit": 1,
//         "boatName": "Giligetaway 3",
//         "imageUrl": "https://ik.imagekit.io/m1akscp5q/SERANGAN-NUSA_PENIDA_-_GILI_TRAWANGAN_VKWR9msbz.png",
//         "toMapUrl": "https://maps.app.goo.gl/qy2kNeurQntdFwNb9###https://ik.imagekit.io/m1akscp5q/gili%20trawangan%20endpoint?updatedAt=1732686816086",
//         "travelers": 2,
//         "fromMapUrl": "https://maps.app.goo.gl/cQ3CQS5888yi9bU7A###https://ik.imagekit.io/m1akscp5q/port%20images/serangan.webp?updatedAt=1738230642741",
//         "isHydrated": false,
//         "returnDate": "",
//         "scheduleId": 60,
//         "totalPrice": 1600000,
//         "checkinTime": "08:15:00",
//         "journeySteps": [
//             {
//                 "arrived": "Nusa Penida",
//                 "duration": "01:00:00",
//                 "departure": "Serangan, Bali",
//                 "checkInTime": "08:15:00",
//                 "timearrived": "10:00:00",
//                 "departuretime": "09:00:00"
//             },
//             {
//                 "arrived": "Gili Trawangan",
//                 "duration": "01:45:00",
//                 "departure": "Nusa Penida",
//                 "checkInTime": "08:30:00",
//                 "timearrived": "11:45:00",
//                 "departuretime": "10:00:00"
//             }
//         ],
//         "totalPayment": 1600000,
//         "departureDate": "19 Jul, 2025",
//         "selectedSeats": [
//             "C4",
//             "C3"
//         ],
//         "subScheduleId": 113,
//         "totalTravelers": 2,
//         "travelersAdult": 2,
//         "travelersChild": 0,
//         "selectedServiceId": 0,
//         "travelersunderthree": 0
//     },
//     "checkinTime": null,
//     "gross_amount": 1632000,
//     "orderDetails": {
//         "name": "Melissa MAFFEI USAGE MAFFEI-ANDERSON",
//         "email": "melissa.maffei@hotmail.com",
//         "phone": "6282221644539",
//         "passportId": "18DI56930",
//         "nationality": "France"
//     },
//     "paymentMethod": "Doku",
//     "booking_source": "website",
//     "passengersAdult": [
//         {
//             "name": "Melissa MAFFEI USAGE MAFFEI-ANDERSON",
//             "passportId": "18DI56930",
//             "nationality": "France",
//             "seat_number": "C3"
//         },
//         {
//             "name": "Leo PADROUTTE",
//             "passportId": "",
//             "nationality": "France",
//             "seat_number": "C4"
//         }
//     ],
//     "passengersChild": [],
//     "transportStatus": {
//         "pickupDetails": {
//             "area": "",
//             "note": "",
//             "type": "",
//             "price": 0,
//             "duration": 0,
//             "quantity": 1,
//             "basePrice": 0,
//             "PickupArea": "",
//             "description": "Provide Transport Details Later",
//             "transport_id": 126,
//             "interval_time": 0,
//             "transport_type": "pickup"
//         },
//         "dropOffDetails": {
//             "area": "",
//             "note": "",
//             "type": "",
//             "price": 0,
//             "duration": 0,
//             "quantity": 0,
//             "basePrice": 0,
//             "PickupArea": "",
//             "description": "",
//             "transport_id": "",
//             "interval_time": 0,
//             "transport_type": "dropoff"
//         }
//     },
//     "gross_total_in_usd": 99.55,
//     "passengerunderthree": []
// }

  const sourceIcons = {
    website: '🌐',
    agent: '👥',
    staff: '👨‍💼'
  };

  for (const [source, entries] of Object.entries(grouped)) {
    if (entries.length === 0) continue;

    const totalAmount = entries.reduce((sum, b) => sum + parseFloat(b.gross_total || 0), 0);
    const totalBookings = entries.length;
    const totalPassengers = entries.reduce((sum, b) => sum + (b.total_passengers || 0), 0);

    emailText += `
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ ${sourceIcons[source] || '📋'} ${source.toUpperCase()} BOOKINGS                                                                                      │
├─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 📊 SUMMARY: ${totalBookings} Bookings | ${totalPassengers} Passengers | ${totalAmount.toLocaleString()} ${entries[0]?.currency || 'IDR'}                     │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘

`;

    entries.forEach((booking, index) => {
      emailText += `
📌 BOOKING #${index + 1}
─────────────────────────────────────────────────────────────────────────────────────────────────────────────────
🆔 Booking ID: ${booking.id}
🎫 Ticket ID: ${booking.ticket_id}
👤 Contact: ${booking.contact_name}
📞 Phone: ${booking.contact_phone}
👨🏻‍🚀 booking by : ${booking.booked_by}
📧 Email: ${booking.contact_email}
🛣️  Route: ${booking.final_state.bookingData?.from || 'N/A'} → ${booking.final_state.bookingData?.to || 'N/A'}
👥 Passengers: ${booking.total_passengers} (Adults: ${booking.adult_passengers}, Children: ${booking.child_passengers}, Infants: ${booking.infant_passengers})
💰 Amount: ${parseFloat(booking.gross_total || 0).toLocaleString()} ${booking.currency || 'IDR'}
📍 Source: ${booking.booking_source || 'N/A'}
📅 Travel Date: ${moment(booking.booking_date).format("MMM D, YYYY")}
🕐 Created: ${moment(booking.created_at).format("MMM D, YYYY h:mm A")}
🔗 Check Ticket: https://giligetaway-widget.my.id/check-ticket/${booking.ticket_id}
🚗 Transport Details:
   Pickup Area: ${booking.final_state.transportStatus.pickupDetails.area || '-'}
     Pickup Note: ${booking.final_state.transportStatus.pickupDetails.note|| '-'}
    Pickup description: ${booking.final_state.transportStatus.pickupDetails.description || '-'}

   Pickup Price: ${booking.final_state.transportStatus.pickupDetails.price || '-'}
   Dropoff Area: ${booking.final_state.transportStatus.dropOffDetails.area || '-'}
      Dropoff Note: ${booking.final_state.transportStatus.dropOffDetails.note || '-'}

   Dropoff description: ${booking.final_state.transportStatus.dropOffDetails.description || '-'}
   Dropoff Price: ${booking.final_state.transportStatus.dropOffDetails.price || '-'}

`;
    });
  }

  return emailText;
};

/**
 * Fungsi untuk mengirim email rangkuman booking harian
 */

// Hitung waktu 15 menit dari sekarang
const testTime = new Date();
testTime.setMinutes(testTime.getMinutes() + 15);

// Format untuk cron: menit jam * * *
const testMinute = testTime.getMinutes();
const testHour = testTime.getHours();
const testCronSchedule = `${testMinute} ${testHour} * * *`;
const sendDailyBookingSummary = async () => {
  console.log("📊 Preparing daily booking summary email...");
  
  try {
    // Mengambil data booking
    const paidBookings = await getYesterdayPaidBookings();
    console.log(`📋 Found ${paidBookings.length} paid bookings from website and agent sources for yesterday.`);
    
    // Jika tidak ada booking, bisa skip atau tetap kirim email kosong
    if (paidBookings.length === 0 && process.env.SEND_EMPTY_SUMMARY !== 'true') {
      console.log("📭 No paid bookings found for yesterday, skipping email.");
      return;
    }
    
    const yesterdayDate = moment().subtract(1, "days").format("MMM D, YYYY");
    const emailSubject = `Daily Booking Summary (${yesterdayDate})`;
    
    // Mengambil email penerima dari environment
    const recipientEmail = process.env.EMAIL_BOOKING;
      
    if (!recipientEmail) {
      console.warn("⚠️ No recipient email configured in EMAIL_BOOKING. Add it in your .env file.");
      return;
    }
    
    // Format email content
    const textContent = formatBookingsToText(paidBookings);
    
    // Kirim email
    const info = await transporter.sendMail({
      from: `"Booking System" <${process.env.EMAIL_BOOKING}>`,
      to: recipientEmail,
      subject: emailSubject,
      text: textContent, // Using plain text instead of HTML
    });
    
    console.log(`📧 Daily booking summary email sent successfully! (${info.messageId})`);
  } catch (error) {
    console.error("❌ Error sending daily booking summary:", error);
  }
};

// Cron schedule untuk menjalankan fungsi setiap hari pukul 1 pagi
// Format: Menit Jam Hari Bulan Hari-Minggu
// '0 1 * * *' = Setiap hari pukul 1:00 AM
// Cron schedule untuk menjalankan fungsi setiap hari pukul 1 pagi
// Format: Menit Jam Hari Bulan Hari-Minggu
// '0 1 * * *' = Setiap hari pukul 1:00 AM
const getDefaultCronSchedule = () => {
  // Pastikan nilai default yang valid
  return '0 1 * * *';
};

// Fungsi untuk menjalankan test dalam 15 menit
const runTestIn15Minutes = () => {
  const delayMinutes = 15;
  const testTime = new Date(Date.now() + delayMinutes * 60 * 1000);
  
  console.log(`⏰ Test scheduled to run at: ${testTime.toLocaleTimeString()}`);
  
  setTimeout(() => {
    console.log(`🧪 Running test now!`);
    sendDailyBookingSummary();
  }, delayMinutes * 60 * 1000);
};

// Mendaftarkan cron job
const scheduleDailySummary = () => {
  // Ambil nilai dari environment, atau gunakan default jika tidak ada atau tidak valid
  let cronSchedule = process.env.DAILY_SUMMARY_CRON;
  
  // Validasi format cron
  if (!cronSchedule || !cron.validate(cronSchedule)) {
    console.warn(`⚠️ Invalid cron schedule: "${cronSchedule}". Using default: "0 1 * * *"`);
    cronSchedule = getDefaultCronSchedule();
  }
  
  console.log(`📅 Scheduling daily booking summary to run at: ${cronSchedule}`);
  
  cron.schedule(cronSchedule, async () => {
    console.log(`⏰ Running daily booking summary job at ${new Date().toISOString()}`);
    await sendDailyBookingSummary();
  });
};

module.exports = {
  scheduleDailySummary,
  sendDailyBookingSummary,
  runTestIn15Minutes, // Function to trigger a test run in 15 minutes,\
  formatBookingsToText
};