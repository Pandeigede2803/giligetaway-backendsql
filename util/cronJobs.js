// /utils/cronJobs.js

const cron = require("node-cron");
const Booking = require("../models/booking");
const Transaction = require("../models/Transaction"); // Pastikan path ini benar sesuai struktur proyek Anda
const { Op } = require("sequelize");
const SeatAvailability = require("../models/SeatAvailability");
const { sendExpiredBookingEmail
} = require("../util/sendPaymentEmail");
const { queueExpiredBookingEmail, DEFAULT_EMAIL_DELAY } = require("../util/bullDelayExpiredEmail"); // Adjust the path as needed
const {handleMidtransSettlement,handleMidtransSettlementRoundTrip} = require("../util/handleMidtransSettlement");


const releaseMainScheduleSeats = require("../util/releaseMainScheduleSeats");
const releaseSubScheduleSeats = require("../util/releaseSubScheduleSeats");
const {fetchMidtransPaymentStatus} = require("../util/fetchMidtransPaymentStatus");
/**
 * Fungsi untuk melepaskan kursi yang sudah dipesan ke available_seats
 * jika pemesanan telah melewati waktu kedaluwarsa
 * @param {Booking} booking Pemesanan yang akan dihapus
 */

const axios = require('axios');


const checkAndHandleMidtransSettlements = async () => {
  // console.log("😻 Running Midtrans settlement fallback check...");

  try {
    const bookings = await Booking.findAll({
      where: {
        payment_status: 'pending',
        payment_method: 'midtrans',
      },
      include: [{ model: Transaction, as: 'transactions' }],
    });

    if (!bookings.length) {
      console.log("📭 No pending Midtrans bookings found.");
      return;
    }

    console.log(`📋 Found ${bookings.length} booking(s) to check.`);

    for (const booking of bookings) {
      const tx = booking.transactions?.[0];

      if (!tx || !tx.payment_order_id) {
        console.warn(`⚠️ Booking ID ${booking.id} has no valid payment_order_id. Skipping...`);
        continue;
      }

      const order_id = tx.payment_order_id;

      try {
        const { paymentStatus, orderId } = await fetchMidtransPaymentStatus(order_id);

        console.log(`🔎 Order ${orderId} → Status: ${paymentStatus}`);

        if (paymentStatus === 'settlement') {
          console.log(`✅ Settlement detected for ${orderId}`);

          // ⛳ Kondisi One Way
          if (booking.ticket_id.startsWith('GG-OW')) {
            console.log(`🎯 One Way Booking ${booking.ticket_id}`);
            await handleMidtransSettlement(orderId, {
              transaction_id: tx.transaction_id,
              gross_amount: tx.amount,
              payment_type: tx.payment_method,
            });
          }

          // ⛳ Kondisi Round Trip
          else if (booking.ticket_id.startsWith('GG-RT')) {
            console.log(`🎯 Round Trip Booking ${booking.ticket_id}`);
            await handleMidtransSettlementRoundTrip(orderId, {
              transaction_id: tx.transaction_id,
              gross_amount: tx.amount,
              payment_type: tx.payment_method,
            });
          }

          // 🔐 Default
          else {
            console.log(`⚠️ Booking ticket ID format tidak dikenali: ${booking.ticket_id}`);
          }
        }
      } catch (apiErr) {
        console.error(`❌ Error checking status for order ${order_id}:`, apiErr.message);
      }
    }
  } catch (fatalErr) {
    console.error("🔥 Fatal error in fallback settlement cron:", fatalErr);
  }
};




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
      booking.abandoned = true;  // Set abandoned to true
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
      
      // Verify if booking has contact_email before sending notification
      if (booking.contact_email) {
        try {
          // Check ticket_id prefix to determine which email utility to use
          if (booking.ticket_id && booking.ticket_id.startsWith("GG-OW")) {
            // Use queueExpiredBookingEmail for GG-OW tickets
            const queued = await queueExpiredBookingEmail(booking.contact_email, booking);
            if (queued) {
              console.log(`📧 GG-OW Expiration notification email queued for ${booking.contact_email} (Booking ID: ${booking.id})`);
            } else {
              console.log(`⚠️ Failed to queue expiration email for ${booking.contact_email} (Booking ID: ${booking.id})`);
            }
          } else if (booking.ticket_id && booking.ticket_id.startsWith("GG-RT")) {
            // For GG-RT tickets, check if this is the first booking of the pair
            // Extract the numeric part after "GG-RT-"
            const ticketNumberMatch = booking.ticket_id.match(/GG-RT-(\d+)/);
            
            if (ticketNumberMatch && ticketNumberMatch[1]) {
              const ticketNumber = parseInt(ticketNumberMatch[1]);
              
              // Only send email for odd-numbered tickets (01, 03, 05, etc.)
              // This assumes ticket pairs are numbered consecutively (01 and 02, 03 and 04, etc.)
              if (ticketNumber % 2 === 1) {
                // Gunakan queueExpiredBookingEmail yang sudah ada, tapi hanya untuk tiket ganjil
                const queued = await queueExpiredBookingEmail(booking.contact_email, booking);
                if (queued) {
                  console.log(`📧 GG-RT Expiration notification email queued for ${booking.contact_email} (Booking ID: ${booking.id})`);
                } else {
                  console.log(`⚠️ Failed to queue GG-RT expiration email for ${booking.contact_email} (Booking ID: ${booking.id})`);
                }
              } else {
                // Untuk tiket genap, lewati pengiriman email karena sudah dikirim oleh tiket ganjil
                console.log(`ℹ️ Skipping email for even-numbered ticket ${booking.ticket_id} (Booking ID: ${booking.id})`);
              }
            } else {
              // Fallback untuk format tiket yang tidak valid
              console.log(`⚠️ Invalid GG-RT ticket format: ${booking.ticket_id}`);
            }
          } else {
            console.log(`ℹ️ No email sent for ticket ID ${booking.ticket_id} - not matching any defined pattern`);
          }
        } catch (emailError) {
          console.error(`❌ Error sending email for booking ID ${booking.id}:`, emailError);
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
cron.schedule(process.env.CRON_FREQUENCY_SETTLEMENT || "*/3 * * * *", async () => {
  console.log("🛡️ Midtrans Fallback Cron Running...");
  await checkAndHandleMidtransSettlements();
});



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
// const handleExpiredBookings = async () => {
//   const expiredStatus = process.env.EXPIRED_STATUS;
//   console.log("✅========Checking for expired bookings...====✅");
  
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
      
//       // Queue expired booking notification email to be sent after seats are released
//       if (booking.contact_email) {
//         try {
//           // Default delay is 3 hours (defined in bullEmailQueue.js)
//           // Can be overridden with EXPIRED_EMAIL_DELAY environment variable
//           const queued = await queueExpiredBookingEmail(booking.contact_email, booking);
//           if (queued) {
//             console.log(`📧 Expiration notification email queued for ${booking.contact_email} (Booking ID: ${booking.id})`);
//           } else {
//             console.log(`⚠️ Failed to queue expiration email for ${booking.contact_email} (Booking ID: ${booking.id})`);
//           }
//         } catch (queueError) {
//           console.error(`❌ Error queuing email for booking ID ${booking.id}:`, queueError);
//         }
//       } else {
//         console.log(`⚠️ No contact email found for booking ID ${booking.id}`);
//       }
      
//       console.log(
//         `Booking ID ${booking.id} dan ticket id ${booking.ticket_id} telah dibatalkan karena melewati waktu kedaluwarsa.`
//       );
//     }
//   } catch (error) {
//     console.error("Error handling expired bookings:", error);
//   }
// };

module.exports = {
  handleExpiredBookings,
};
