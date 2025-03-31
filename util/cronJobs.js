// /utils/cronJobs.js

const cron = require("node-cron");
const Booking = require("../models/booking");
const Transaction = require("../models/Transaction"); // Pastikan path ini benar sesuai struktur proyek Anda
const { Op } = require("sequelize");
const SeatAvailability = require("../models/SeatAvailability");
const { sendExpiredBookingEmail
} = require("../util/sendPaymentEmail");
const { queueExpiredBookingEmail, DEFAULT_EMAIL_DELAY } = require("../util/bullDelayExpiredEmail"); // Adjust the path as needed


const releaseMainScheduleSeats = require("../util/releaseMainScheduleSeats");
const releaseSubScheduleSeats = require("../util/releaseSubScheduleSeats");
/**
 * Fungsi untuk melepaskan kursi yang sudah dipesan ke available_seats
 * jika pemesanan telah melewati waktu kedaluwarsa
 * @param {Booking} booking Pemesanan yang akan dihapus
 */

const releaseSeats = async (booking, transaction) => {
  const { schedule_id, subschedule_id, total_passengers, booking_date } =
    booking;

  console.log(`✅ MEMULAI RELEASE SEATS FOR BOOKING ID: ${booking.id}...`);

  try {
    if (subschedule_id) {
      // Jika SubSchedule ada, kembalikan kursi untuk SubSchedule
      await releaseSubScheduleSeats(
        schedule_id,
        subschedule_id,
        booking_date,
        total_passengers,
        transaction
      );
    } else {
      // Jika Main Schedule, kembalikan kursi untuk Main Schedule
      await releaseMainScheduleSeats(
        schedule_id,
        booking_date,
        total_passengers,
        transaction
      );
    }

    console.log(
      `🎉Berhasil melepaskan ${total_passengers} kursi untuk Booking ID: ${booking.id}🎉`
    );
  } catch (error) {
    console.error(
      `Gagal melepaskan kursi untuk Booking ID: ${booking.id}`,
      error
    );
    throw error;
  }
};
/**
 * Fungsi untuk menghandle pemesanan yang telah melewati waktu kedaluwarsa
 * Mencari pemesanan yang telah melewati waktu kedaluwarsa dan melepaskan kursi yang sudah dipesan
 */


// const handleExpiredBookings = async () => {

//   const expiredStatus = process.env.EXPIRED_STATUS
//   console.log("	✅========Checking for expired bookings...====	✅");
//   try {
//     const expiredBookings = await Booking.findAll({
//       where: {
//         payment_status: "pending",
//         expiration_time: {
//           [Op.lte]: new Date(), // Mencari pemesanan yang sudah melewati waktu kedaluwarsa
//         },
//       },
//       include: [
//         {
//           model: Transaction, // Include the related transaction
//           as: "transactions", // Assuming the association is correctly named
//         },
//       ],
//     });

//     for (let booking of expiredBookings) {
//       // Logika untuk melepaskan kursi yang sudah dipesan ke available_seats
//       await releaseSeats(booking);

//       // Update status pemesanan menjadi 'cancelled'
//       booking.payment_status = expiredStatus;
//       await booking.save();

//       // Update related transaction status to 'cancelled'
//       const transaction = await Transaction.findOne({
//         where: { booking_id: booking.id, status: "pending" }, // Only cancel pending transactions
//       });

//       if (transaction) {
//         transaction.status = "cancelled";
//         await transaction.save();

//         console.log(
//           `Transaction ID ${transaction.transaction_id} telah dibatalkan karena pemesanan melewati waktu kedaluwarsa.`
//         );
//       }

//       console.log(
//         `Booking ID ${booking.id} dan ticket id ${booking.ticket_id} telah dibatalkan karena melewati waktu kedaluwarsa.`
//       );
//     }
//   } catch (error) {
//     console.error("Error handling expired bookings:", error);
//   }
// };

//new function with email
const handleExpiredBookings = async () => {
  const expiredStatus = process.env.EXPIRED_STATUS;
  console.log("✅========Checking for expired bookings...====✅");
  
  try {
    const expiredBookings = await Booking.findAll({
      where: {
        payment_status: "pending",
        expiration_time: {
          [Op.lte]: new Date(), // Mencari pemesanan yang sudah melewati waktu kedaluwarsa
        },
      },
      include: [
        {
          model: Transaction, // Include the related transaction
          as: "transactions", // Assuming the association is correctly named
        },
      ],
    });
    
    for (let booking of expiredBookings) {
      // Logika untuk melepaskan kursi yang sudah dipesan ke available_seats
      await releaseSeats(booking);
      
      // Update status pemesanan menjadi 'cancelled'
      booking.payment_status = expiredStatus;
      await booking.save();
      
      // Update related transaction status to 'cancelled'
      const transaction = await Transaction.findOne({
        where: { booking_id: booking.id, status: "pending" }, // Only cancel pending transactions
      });
      
      if (transaction) {
        transaction.status = "cancelled";
        await transaction.save();
        
        console.log(
          `Transaction ID ${transaction.transaction_id} telah dibatalkan karena pemesanan melewati waktu kedaluwarsa.`
        );
      }
      
      // Queue expired booking notification email to be sent after seats are released
      if (booking.contact_email) {
        try {
          // Default delay is 3 hours (defined in bullEmailQueue.js)
          // Can be overridden with EXPIRED_EMAIL_DELAY environment variable
          const queued = await queueExpiredBookingEmail(booking.contact_email, booking);
          if (queued) {
            console.log(`📧 Expiration notification email queued for ${booking.contact_email} (Booking ID: ${booking.id})`);
          } else {
            console.log(`⚠️ Failed to queue expiration email for ${booking.contact_email} (Booking ID: ${booking.id})`);
          }
        } catch (queueError) {
          console.error(`❌ Error queuing email for booking ID ${booking.id}:`, queueError);
        }
      } else {
        console.log(`⚠️ No contact email found for booking ID ${booking.id}`);
      }
      
      console.log(
        `Booking ID ${booking.id} dan ticket id ${booking.ticket_id} telah dibatalkan karena melewati waktu kedaluwarsa.`
      );
    }
  } catch (error) {
    console.error("Error handling expired bookings:", error);
  }
};


// Ambil frekuensi cron dari variabel environment, dengan default setiap 15 menit
const cronFrequency = process.env.CRON_FREQUENCY || "*/5 * * * *"; // Default 15 menit

// Menjadwalkan cron job dengan frekuensi dari env
cron.schedule(cronFrequency, async () => {
  await handleExpiredBookings();
});

module.exports = {
  handleExpiredBookings,
};
