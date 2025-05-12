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
        payment_status: "paid",
        created_at: {
          [Op.gte]: yesterday.toDate(),
          [Op.lt]: today.toDate(),
        },
        booking_source: {
          [Op.in]: ['website', 'agent'] // Only include website and agent bookings
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
        'created_at'
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

const formatBookingsToText = (bookings) => {
  if (!bookings || bookings.length === 0) {
    return "No paid bookings were created yesterday.";
  }

  const totalAmount = bookings.reduce((sum, booking) => sum + parseFloat(booking.gross_total || 0), 0);
  const totalBookings = bookings.length;
  const totalPassengers = bookings.reduce((sum, booking) => sum + (booking.total_passengers || 0), 0);
  
  // Format date for the summary
  const yesterdayDate = moment().subtract(1, "days").format("MMMM D, YYYY");
  
  // Create summary text
  let emailText = `TESTING DAILY BOOKING SUMMARY - ${yesterdayDate}\n\n`;
  emailText += `SUMMARY:\n`;
  emailText += `Total Bookings: ${totalBookings}\n`;
  emailText += `Total Passengers: ${totalPassengers}\n`;
  emailText += `Total Revenue: ${totalAmount.toLocaleString()} ${bookings[0]?.currency || 'IDR'}\n\n`;
  
  emailText += `BOOKING DETAILS:\n\n`;
  
  // Add each booking as a simple text entry
  bookings.forEach((booking, index) => {
    emailText += `${index + 1}. Booking ID: ${booking.id}\n`;
    emailText += `   Ticket ID: ${booking.ticket_id}\n`;
    emailText += `   Contact: ${booking.contact_name}\n`;
    emailText += `   Phone: ${booking.contact_phone}\n`;
    emailText += `   Email: ${booking.contact_email}\n`;
    emailText += `   Passengers: ${booking.total_passengers} (Adults: ${booking.adult_passengers}, Children: ${booking.child_passengers}, Infants: ${booking.infant_passengers})\n`;
    emailText += `   Amount: ${parseFloat(booking.gross_total || 0).toLocaleString()} ${booking.currency || 'IDR'}\n`;
    emailText += `   Booking Source: ${booking.booking_source || 'N/A'}\n`;
    emailText += `   Booking Date: ${moment(booking.booking_date).format("MMM D, YYYY")}\n`;
    emailText += `   Created: ${moment(booking.created_at).format("MMM D, YYYY h:mm A")}\n\n`;
  });
  
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
  runTestIn15Minutes // Function to trigger a test run in 15 minutes
};