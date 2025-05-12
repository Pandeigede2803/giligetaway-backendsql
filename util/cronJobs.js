// /utils/cronJobs.js

const cron = require("node-cron");
const Booking = require("../models/booking");
const Transaction = require("../models/Transaction"); // Pastikan path ini benar sesuai struktur proyek Anda
const { Op } = require("sequelize");
const SeatAvailability = require("../models/SeatAvailability");
const { sendExpiredBookingEmail
} = require("../util/sendPaymentEmail");
const { queueExpiredBookingEmail,bulkQueueExpiredBookingEmails, DEFAULT_EMAIL_DELAY } = require("../util/bullDelayExpiredEmail"); // Adjust the path as needed
const {handleMidtransSettlement,handleMidtransSettlementRoundTrip} = require("../util/handleMidtransSettlement");


const releaseMainScheduleSeats = require("../util/releaseMainScheduleSeats");
const releaseSubScheduleSeats = require("../util/releaseSubScheduleSeats");
const {fetchMidtransPaymentStatus} = require("../util/fetchMidtransPaymentStatus");
/**
 * Fungsi untuk melepaskan kursi yang sudah dipesan ke available_seats
 * jika pemesanan telah melewati waktu kedaluwarsa
 * @param {Booking} booking Pemesanan yang akan dihapus
 */

const axios = require('axios');;
const sequelize = require('../config/database');


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

        // console.log(`🔎 Order ${orderId} → Status: ${paymentStatus}`);

        if (paymentStatus === 'settlement') {
          // console.log(`✅ Settlement detected for ${orderId}`);

          // ⛳ Kondisi One Way
          if (booking.ticket_id.startsWith('GG-OW')) {
            // console.log(`🎯 One Way Booking ${booking.ticket_id}`);
            await handleMidtransSettlement(orderId, {
              transaction_id: tx.transaction_id,
              gross_amount: tx.amount,
              payment_type: tx.payment_method,
            });
          }

          // ⛳ Kondisi Round Trip
          else if (booking.ticket_id.startsWith('GG-RT')) {
            // console.log(`🎯 Round Trip Booking ${booking.ticket_id}`);
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

  // console.log(`✅ MEMULAI RELEASE SEATS FOR BOOKING ID: ${booking.id}...`);

  try {
    if (subschedule_id) {
      console.log(
        `start releaseSubScheduleSeats, schedule_id: ${schedule_id}, subschedule_id: ${subschedule_id}, booking_date: ${booking_date}, total_passengers: ${total_passengers}`
      );
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
      console.log("start releaseMainScheduleSeats");
      console.log(
        `schedule_id: ${schedule_id}, booking_date: ${booking_date}, total_passengers: ${total_passengers}`
      );
      await releaseMainScheduleSeats(
        schedule_id,
        booking_date,
        total_passengers,
        transaction
      );
    }

    // console.log(
    //   `🎉Berhasil melepaskan ${total_passengers} kursi untuk Booking ID: ${booking.id}🎉`
    // );
  } catch (error) {
    console.error(
      `😻Gagal melepaskan kursi untuk Booking ID: ${booking.id} dan ticket ID: ${booking.ticket_id}`, 
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
//   const expiredStatus = process.env.EXPIRED_STATUS;
//   const emailedContacts = new Set();

//   console.log("✅========Checking for expired bookings...====✅");

//   try {
//     const expiredBookings = await Booking.findAll({
//       where: {
//         payment_status: "pending",
//         expiration_time: {
//           [Op.lte]: new Date(),
//         },
//       },
//       include: [
//         {
//           model: Transaction,
//           as: "transactions",
//         },
//       ],
//       order: [['contact_email', 'ASC'], ['created_at', 'ASC']], // penting agar urutan booking per email benar
//     });

//     for (let i = 0; i < expiredBookings.length; i++) {
//       const booking = expiredBookings[i];
//       const contactEmail = booking.contact_email;

//       await releaseSeats(booking);
//       booking.payment_status = expiredStatus;
//       booking.abandoned = true;
//       await booking.save();

//       const transaction = await Transaction.findOne({
//         where: { booking_id: booking.id, status: "pending" },
//       });

//       if (transaction) {
//         transaction.status = "cancelled";
//         await transaction.save();
//       }

//       let shouldSendEmail = false;

//       // Cek apakah contactEmail sudah dikirim email di proses ini
//       if (
//         contactEmail &&
//         !emailedContacts.has(contactEmail)
//       ) {
//         // Cek apakah ada booking lain dengan email sama dan created_at sangat dekat
//         const recentBookings = expiredBookings.filter((b) =>
//           b.contact_email === contactEmail &&
//           b.id !== booking.id &&
//           Math.abs(new Date(b.created_at).getTime() - new Date(booking.created_at).getTime()) < 10 * 60 * 1000 // < 10 menit
//         );

//         // Jika tidak ada booking lain yang sangat dekat waktunya, boleh kirim email
//         if (recentBookings.length === 0) {
//           if (booking.ticket_id?.startsWith("GG-OW")) {
//             shouldSendEmail = true;
//           } else if (booking.ticket_id?.startsWith("GG-RT")) {
//             const match = booking.ticket_id.match(/GG-RT-(\d+)/);
//             if (match && parseInt(match[1]) % 2 === 1) {
//               shouldSendEmail = true;
//             }
//           }

//           if (shouldSendEmail) {
//             const queued = await queueExpiredBookingEmail(contactEmail, booking);
//             if (queued) {
//               emailedContacts.add(contactEmail);
//               console.log(`📧 Expired email sent to ${contactEmail} (Booking ID: ${booking.id})`);
//             }
//           }
//         } else {
//           console.log(`🛑 Email skipped for ${contactEmail}, booking created near another.`);
//         }
//       } else if (!contactEmail) {
//         console.log(`⚠️ No contact email for Booking ID ${booking.id}`);
//       } else {
//         console.log(`⛔ Email already sent to ${contactEmail}, skipping.`);
//       }

//       console.log(`Booking ${booking.id} (ticket ${booking.ticket_id}) expired and cancelled.`);
//     }
//   } catch (error) {
//     console.error("❌ Error handling expired bookings:", error);
//   }
// };

// const handleExpiredBookings = async () => {
//   const expiredStatus = process.env.EXPIRED_STATUS;
//   const emailedContacts = new Set();

//   console.log("✅========Checking for expired bookings (batched)...====✅");

//   let batchSize = 100; // Ambil 100 booking per batch
//   let offset = 0; // Start dari offset 0
//   let hasMore = true; // Untuk kontrol loop

//   try {
//     while (hasMore) {
//       const expiredBookings = await Booking.findAll({
//         where: {
//           payment_status: "pending",
//           expiration_time: { [Op.lte]: new Date() },
//         },
//         include: [{ model: Transaction, as: "transactions" }],
//         order: [['contact_email', 'ASC'], ['created_at', 'ASC']],
//         limit: batchSize,
//         offset: offset,
//       });

//       console.log(`📦 Fetched ${expiredBookings.length} expired bookings (offset: ${offset})`);

//       if (expiredBookings.length === 0) {
//         hasMore = false;
//         break;
//       }

//       for (const booking of expiredBookings) {
//         const contactEmail = booking.contact_email;

//         await releaseSeats(booking);
//         booking.payment_status = expiredStatus;
//         booking.abandoned = true;
//         await booking.save();

//         const transaction = await Transaction.findOne({
//           where: { booking_id: booking.id, status: "pending" },
//         });

//         if (transaction) {
//           transaction.status = "cancelled";
//           await transaction.save();
//         }

//         let shouldSendEmail = false;

//         if (contactEmail && !emailedContacts.has(contactEmail)) {
//           const recentBookings = expiredBookings.filter((b) =>
//             b.contact_email === contactEmail &&
//             b.id !== booking.id &&
//             Math.abs(new Date(b.created_at).getTime() - new Date(booking.created_at).getTime()) < 10 * 60 * 1000 // < 10 menit
//           );

//           if (recentBookings.length === 0) {
//             if (booking.ticket_id?.startsWith("GG-OW")) {
//               shouldSendEmail = true;
//             } else if (booking.ticket_id?.startsWith("GG-RT")) {
//               const match = booking.ticket_id.match(/GG-RT-(\d+)/);
//               if (match && parseInt(match[1]) % 2 === 1) {
//                 shouldSendEmail = true;
//               }
//             }

//             if (shouldSendEmail) {
//               const queued = await queueExpiredBookingEmail(contactEmail, booking);
//               if (queued) {
//                 emailedContacts.add(contactEmail);
//                 console.log(`📧 Expired email queued for ${contactEmail} (Booking ID: ${booking.id})`);
//               }
//             }
//           } else {
//             console.log(`🛑 Email skipped for ${contactEmail}, booking created near another.`);
//           }
//         } else if (!contactEmail) {
//           console.log(`⚠️ No contact email for Booking ID ${booking.id}`);
//         } else {
//           console.log(`⛔ Email already sent to ${contactEmail}, skipping.`);
//         }

//         console.log(`✅ Booking ${booking.id} (ticket ${booking.ticket_id}) expired and cancelled.`);
//       }

//       offset += batchSize; // Naikkan offset untuk ambil batch berikutnya
//     }

//     console.log("🏁 Finished processing all expired bookings.");
//   } catch (error) {
//     console.error("❌ Error handling expired bookings:", error);
//   }
// };

const handleExpiredBookings = async () => {
  const expiredStatus = process.env.EXPIRED_STATUS;
  const emailedContacts = new Set();

  console.log("✅========Checking for expired bookings (batched)...====✅");

  let batchSize = 100;
  let offset = 0;
  let hasMore = true;

  try {
    while (hasMore) {
      const expiredBookings = await Booking.findAll({
        where: {
          payment_status: "pending",
          expiration_time: { [Op.lte]: new Date() },
        },
        include: [{ model: Transaction, as: "transactions" }],
        order: [['contact_email', 'ASC'], ['created_at', 'ASC']],
        limit: batchSize,
        offset: offset,
      });

      console.log(`📦 Fetched ${expiredBookings.length} expired bookings (offset: ${offset})`);

      if (expiredBookings.length === 0) {
        hasMore = false;
        break;
      }

      for (const booking of expiredBookings) {
        try {
          // Gunakan satu transaksi untuk seluruh proses update booking dan release seats
          await sequelize.transaction(async (t) => {
            const contactEmail = booking.contact_email;
            
            console.log(`\n🔄 Processing expired booking ID: ${booking.id}, ticket: ${booking.ticket_id}`);
            
            // Release seats dengan transaksi
            console.log(`\n🪑 Releasing seats for expired booking ID: ${booking.id}`);
            const releasedSeatIds = await releaseSeats(booking, t);
            // console.log(`✅ Released seats: ${releasedSeatIds.length > 0 ? releasedSeatIds.join(", ") : "None"}`);
            
            // Update booking status dalam transaksi yang sama
            console.log(`\n🔄 Updating booking status to ${expiredStatus}`);
            booking.payment_status = expiredStatus;
            booking.abandoned = true;
            await booking.save({ transaction: t });
            
            // Update transaction status dalam transaksi yang sama
            const transaction = await Transaction.findOne({
              where: { booking_id: booking.id, status: "pending" },
              transaction: t
            });

            if (transaction) {
              console.log(`\n🔄 Updating transaction status to cancelled`);
              transaction.status = "cancelled";
              await transaction.save({ transaction: t });
            }
            
            console.log(`✅ Booking ${booking.id} (ticket ${booking.ticket_id}) expired and processed successfully.`);
          });
          
          // Email handling (di luar transaksi database)
          let shouldSendEmail = false;
          const contactEmail = booking.contact_email;

          if (contactEmail && !emailedContacts.has(contactEmail)) {
            // Cek apakah ada booking lain dari email yang sama dalam waktu 10 menit
            const recentBookings = expiredBookings.filter((b) =>
              b.contact_email === contactEmail &&
              b.id !== booking.id &&
              Math.abs(new Date(b.created_at).getTime() - new Date(booking.created_at).getTime()) < 10 * 60 * 1000 // < 10 menit
            );

            if (recentBookings.length === 0) {
              // Aturan pengiriman email berdasarkan jenis tiket
              if (booking.ticket_id?.startsWith("GG-OW")) {
                // Untuk tiket One Way (GG-OW), selalu kirim email
                shouldSendEmail = true;
              } else if (booking.ticket_id?.startsWith("GG-RT")) {
                // Untuk tiket Round Trip (GG-RT), hanya kirim untuk nomor ganjil
                const match = booking.ticket_id.match(/GG-RT-(\d+)/);
                if (match && parseInt(match[1]) % 2 === 1) {
                  shouldSendEmail = true;
                }
              }

              if (shouldSendEmail) {
                // Queue email dengan sistem antrian untuk menghindari overload
                console.log(`\n📨 Queueing expired booking email for ${contactEmail}`);
                const queued = await queueExpiredBookingEmail(contactEmail, booking);
                
                if (queued) {
                  // Tandai email sudah dikirim untuk menghindari duplikasi
                  emailedContacts.add(contactEmail);
                  console.log(`📧 Expired email queued for ${contactEmail} (Booking ID: ${booking.id})`);
                } else {
                  console.log(`❌ Failed to queue email for ${contactEmail} (Booking ID: ${booking.id})`);
                }
              } else {
                console.log(`🔄 No email needed for ${booking.ticket_id} based on ticket rules`);
              }
            } else {
              console.log(`🛑 Email skipped for ${contactEmail}, booking created near another.`);
            }
          } else if (!contactEmail) {
            console.log(`⚠️ No contact email for Booking ID ${booking.id}`);
          } else {
            console.log(`⛔ Email already sent to ${contactEmail}, skipping.`);
          }
          
        } catch (bookingError) {
          console.error(`❌ Error processing expired booking ${booking.id}:`, bookingError);
          // Lanjutkan ke booking berikutnya meskipun ada error
        }
      }

      offset += batchSize; // Naikkan offset untuk ambil batch berikutnya
    }

    console.log("🏁 Finished processing all expired bookings.");
  } catch (error) {
    console.error("❌ Error handling expired bookings:", error);
  }
};


// const handleExpiredBookings = async () => {
//   const expiredStatus = process.env.EXPIRED_STATUS;
//   const emailedContacts = new Set();

//   console.log("✅========Checking for expired bookings (batched)...====✅");

//   let batchSize = 100;
//   let offset = 0;
//   let hasMore = true;

//   try {
//     while (hasMore) {
//       const expiredBookings = await Booking.findAll({
//         where: {
//           payment_status: "pending",
//           expiration_time: { [Op.lte]: new Date() },
//         },
//         include: [{ model: Transaction, as: "transactions" }],
//         order: [['contact_email', 'ASC'], ['created_at', 'ASC']],
//         limit: batchSize,
//         offset: offset,
//       });

//       console.log(`📦 Fetched ${expiredBookings.length} expired bookings (offset: ${offset})`);

//       if (expiredBookings.length === 0) {
//         hasMore = false;
//         break;
//       }

//       const emailsToQueue = []; // <<-- Kumpulkan booking yang mau dikirimi email

//       for (const booking of expiredBookings) {
//         const contactEmail = booking.contact_email;

//         await releaseSeats(booking);
//         booking.payment_status = expiredStatus;
//         booking.abandoned = true;
//         await booking.save();

//         const transaction = await Transaction.findOne({
//           where: { booking_id: booking.id, status: "pending" },
//         });

//         if (transaction) {
//           transaction.status = "cancelled";
//           await transaction.save();
//         }

//         let shouldSendEmail = false;

//         if (contactEmail && !emailedContacts.has(contactEmail)) {
//           const recentBookings = expiredBookings.filter((b) =>
//             b.contact_email === contactEmail &&
//             b.id !== booking.id &&
//             Math.abs(new Date(b.created_at).getTime() - new Date(booking.created_at).getTime()) < 10 * 60 * 1000
//           );

//           if (recentBookings.length === 0) {
//             if (booking.ticket_id?.startsWith("GG-OW")) {
//               shouldSendEmail = true;
//             } else if (booking.ticket_id?.startsWith("GG-RT")) {
//               const match = booking.ticket_id.match(/GG-RT-(\d+)/);
//               if (match && parseInt(match[1]) % 2 === 1) {
//                 shouldSendEmail = true;
//               }
//             }

//             if (shouldSendEmail) {
//               emailsToQueue.push(booking); // <<-- Tambahkan booking ke array
//               emailedContacts.add(contactEmail);
//             }
//           } else {
//             console.log(`🛑 Email skipped for ${contactEmail}, booking created near another.`);
//           }
//         } else if (!contactEmail) {
//           console.log(`⚠️ No contact email for Booking ID ${booking.id}`);
//         } else {
//           console.log(`⛔ Email already sent to ${contactEmail}, skipping.`);
//         }

//         console.log(`✅ Booking ${booking.id} (ticket ${booking.ticket_id}) expired and cancelled.`);
//       }

//       // 🔥 Setelah selesai proses semua expiredBooking batch ini, baru sekali bulk add
//       if (emailsToQueue.length > 0) {
//         await bulkQueueExpiredBookingEmails(emailsToQueue); // <<-- Bulk Queue disini
//       }

//       offset += batchSize;
//     }

//     console.log("🏁 Finished processing all expired bookings.");
//   } catch (error) {
//     console.error("❌ Error handling expired bookings:", error);
//   }
// };


// Ambil frekuensi cron dari variabel environment, dengan default setiap 15 menit
const cronFrequency = process.env.CRON_FREQUENCY || "*/5 * * * *"; // Default 15 menit


// Menjadwalkan cron job dengan frekuensi dari env
cron.schedule(cronFrequency, async () => {
  await handleExpiredBookings();

});
// cron.schedule(process.env.CRON_FREQUENCY_SETTLEMENT || "*/3 * * * *", async () => {
//   console.log("🛡️ Midtrans Fallback Cron Running...");
//   await checkAndHandleMidtransSettlements();
// });



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
