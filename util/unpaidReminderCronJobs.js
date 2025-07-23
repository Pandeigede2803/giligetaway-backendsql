// /utils/unpaidReminderCronJobs.js
// const cron = require("node-cron");
// const Booking = require("../models/booking");
// const Transaction = require("../models/Transaction");
// const { Op } = require("sequelize");
// const { sendPaymentEmail } = require("../utils/sendEmail");
// const { sendUnpaidReminderEmail } = require("../utils/sendUnpaidReminder");

// /utils/unpaidReminderCronJobs.js
const cron = require("node-cron");
const {releaseBookingSeats} = require("./releaseSeats");
const {
  sequelize,
  Booking,
  SeatAvailability,
  Destination,
  Transport,
  Schedule,
  SubSchedule,
  Transaction,
  Passenger,
  Transit,
  TransportBooking,
  AgentMetrics,
  Agent,
  BookingSeatAvailability,
  Boat,
} = require("../models");

const { Op } = require("sequelize");
const {
  sendUnpaidReminderEmail,
  sendUnpaidReminderEmailToAgent,
  sendCancellationEmail,
  sendCancellationEmailToAgent,
} = require("./sendPaymentEmail");
const { create } = require("handlebars");

// 🔧 Configurable from .env




const cronSchedule = process.env.UNPAID_CRON_SCHEDULE ||"*/15 * * * *";;
console.log(`🔧 Unpaid reminder cron schedule: ${cronSchedule}`);
const reminderLevels = process.env.UNPAID_REMINDER_HOURS
  ? process.env.UNPAID_REMINDER_HOURS.split(",").map((v) => parseInt(v.trim()))
  : [3, 6, 12];

const expiryHour = parseInt(process.env.UNPAID_CANCEL_AFTER_HOURS || "24");
const enableLogging = process.env.ENABLE_UNPAID_CRON_LOGGING === "true";

/**
 * Cron function to send unpaid booking reminders and cancel expired bookings
 */
const sendUnpaidReminders = async () => {
  const now = new Date();

  const bookings = await Booking.findAll({
    where: {
      payment_status: "unpaid",
      payment_method: "collect from customer",
      reminder_hours: { [Op.lt]: expiryHour },
    },
    include: [
      { model: Agent, as: "Agent" },
      { model: Transaction, as: "transactions" },
    ],
  });

  for (const booking of bookings) {
    const createdAt = new Date(booking.created_at);
    const hoursSince = Math.floor((now - createdAt) / 36e5);
    // const hoursSince = Math.floor((now - createdAt) / (60 * 1000)); // use minutes for dev testing

    const customerEmail = booking.contact_email || booking.email;
    const agentEmail = booking.Agent?.email || null;

    // === 1. CANCEL BOOKING IF EXPIRED ===
    if (hoursSince >= expiryHour) {
      const sequelizeTx = await sequelize.transaction();
      try {
        booking.payment_status = "abandoned";
        await booking.save({ transaction: sequelizeTx });

        const tx = await Transaction.findOne({
          where: { booking_id: booking.id, status: "unpaid" },
          transaction: sequelizeTx,
        });

        if (tx) {
          tx.status = "cancelled";
          await tx.save({ transaction: sequelizeTx });
        }

        await releaseBookingSeats(booking.id, sequelizeTx);
        await sendCancellationEmail(customerEmail, booking);
        if (agentEmail) {
          await sendCancellationEmailToAgent(agentEmail, customerEmail, booking);
        }

        await sequelizeTx.commit();

        if (enableLogging) {
          console.log(`❌ Booking ID ${booking.id} expired and marked as abandoned.`);
        }
        continue;
      } catch (err) {
        await sequelizeTx.rollback();
        console.error(`❌ Error cancelling booking ID ${booking.id}:`, err);
        continue;
      }
    }

    // === 2. SEND NEXT REMINDER IF NEEDED ===
    const nextReminder = reminderLevels.find(
      (h) => h > booking.reminder_hours && h <= hoursSince
    );

    if (nextReminder) {
      const reminderIndex = reminderLevels.indexOf(nextReminder) + 1;

      try {
        await sendUnpaidReminderEmail(customerEmail, booking, reminderIndex);
        if (agentEmail) {
          await sendUnpaidReminderEmailToAgent(agentEmail, customerEmail, booking, reminderIndex);
        }

        booking.reminder_hours = nextReminder;
        await booking.save();

        if (enableLogging) {
          console.log(`📩 Reminder #${reminderIndex} sent for Booking ID ${booking.id}`);
        }
      } catch (err) {
        console.error(`❌ Failed to send reminder for Booking ID ${booking.id}:`, err);
      }
    }
  }
};

// 🕒 Run cron job on schedule
cron.schedule(cronSchedule, async () => {
  if (enableLogging) {
    console.log(`🕒 Running unpaid reminder cron job: ${cronSchedule}`);
  }
  await sendUnpaidReminders();
});

module.exports = {
  sendUnpaidReminders,

};



// // Get reminder timing settings from environment variables with defaults
// const FIRST_REMINDER_HOUR = parseInt(
//   process.env.UNPAID_FIRST_REMINDER_HOUR || "6"
// );
// const SECOND_REMINDER_HOUR = parseInt(
//   process.env.UNPAID_SECOND_REMINDER_HOUR || "12"
// );
// const THIRD_REMINDER_HOUR = parseInt(
//   process.env.UNPAID_THIRD_REMINDER_HOUR || "18"
// );
// const CANCELLATION_HOUR = parseInt(
//   process.env.UNPAID_CANCELLATION_HOUR || "24"
// );
// const TIME_TOLERANCE = parseFloat(process.env.UNPAID_TIME_TOLERANCE || "0.5"); // 30 minutes default

/**
 * Function to send payment reminder emails for bookings with unpaid status
 * Emails will be sent at configurable hours after booking creation
 * Bookings will be canceled after cancellation hour if still unpaid
 */
// const sendUnpaidReminders = async () => {
//   console.log(
//     "✅========Checking for unpaid bookings needing reminders...====✅"
//   );
//   console.log(
//     `Reminder hours: ${FIRST_REMINDER_HOUR}h, ${SECOND_REMINDER_HOUR}h, ${THIRD_REMINDER_HOUR}h`
//   );
//   console.log(
//     `Cancellation hour: ${CANCELLATION_HOUR}h, Tolerance: ${TIME_TOLERANCE}h`
//   );

//   try {
//     // Get current time
//     const now = new Date();

//     // Find bookings with unpaid status
//     const unpaidBookings = await Booking.findAll({
//       where: {
//         payment_status: "unpaid",
//       },

//       include: [
//         {
//           model: Transaction,
//           as: "transactions",
//         },
//         {
//           model: Agent,
//           as: "Agent",
//         },
//       ],
//       limit: parseInt(process.env.UNPAID_BATCH_LIMIT || "100"), // Configurable batch limit
//     });

//     console.log(
//       "🧒🏻bookings",
//       unpaidBookings.map((b) => b.Agent?.email || "No Agent") // Tambahkan ? untuk menghindari error jika Agent null
//     );

//     console.log(`Found ${unpaidBookings.length} unpaid bookings to check`);

//     // Filter bookings that need reminders based on booking age
//     const bookingsNeedingReminders = [];
//     const bookingsToCancel = [];

//     for (const booking of unpaidBookings) {
//       const createdAt = new Date(booking.created_at);
//       const hoursSinceCreation = Math.floor(
//         (now - createdAt) / (1000 * 60 * 60)
//       );

//       // If booking is past cancellation hour, mark for cancellation
//       if (hoursSinceCreation >= CANCELLATION_HOUR) {
//         bookingsToCancel.push(booking);
//       }
//       // Menentukan reminder dengan jendela waktu yang lebih lebar
//       else if (
//         // Reminder pertama: antara FIRST_REMINDER_HOUR dan SECOND_REMINDER_HOUR
//         (hoursSinceCreation >= FIRST_REMINDER_HOUR && 
//         hoursSinceCreation < SECOND_REMINDER_HOUR &&
//         hoursSinceCreation < FIRST_REMINDER_HOUR + 2) || // Beri jendela 2 jam
        
//         // Reminder kedua: antara SECOND_REMINDER_HOUR dan THIRD_REMINDER_HOUR
//         (hoursSinceCreation >= SECOND_REMINDER_HOUR && 
//         hoursSinceCreation < THIRD_REMINDER_HOUR &&
//         hoursSinceCreation < SECOND_REMINDER_HOUR + 2) || // Beri jendela 2 jam
        
//         // Reminder ketiga: antara THIRD_REMINDER_HOUR dan CANCELLATION_HOUR
//         (hoursSinceCreation >= THIRD_REMINDER_HOUR && 
//         hoursSinceCreation < CANCELLATION_HOUR &&
//         hoursSinceCreation < THIRD_REMINDER_HOUR + 2) // Beri jendela 2 jam
//       ) {
//         // Determine reminder level based on age
//         let reminderLevel = 1;
//         if (hoursSinceCreation >= THIRD_REMINDER_HOUR) {
//           reminderLevel = 3; // Third reminder
//         } else if (hoursSinceCreation >= SECOND_REMINDER_HOUR) {
//           reminderLevel = 2; // Second reminder
//         }

//         bookingsNeedingReminders.push({
//           booking,
//           reminderLevel,
//           hoursSinceCreation,
//         });
//       }
//     }

//     console.log(`From ${unpaidBookings.length} unpaid bookings:`);
//     console.log(`- ${bookingsNeedingReminders.length} bookings need reminders`);
//     console.log(
//       `- ${bookingsToCancel.length} bookings need to be canceled (unpaid > ${CANCELLATION_HOUR} hours)`
//     );

//     // 1. Process reminder emails
//     if (bookingsNeedingReminders.length > 0) {
//       await processReminders(bookingsNeedingReminders);
//     }

//     // 2. Process cancellation for bookings past the cancellation hour
//     if (bookingsToCancel.length > 0) {
//       await cancelUnpaidBookings(bookingsToCancel);
//     }

//     console.log("✅ Reminder and cancellation process completed ✅");
//   } catch (error) {
//     console.error("❌ Error handling unpaid reminders:", error);
//   }
// // };

// /**
//  * Function to process reminder emails in batches
//  * @param {Array} bookingsNeedingReminders - Array of bookings needing reminders
//  */
// async function processReminders(bookingsNeedingReminders) {
//   // Batch implementation - process in batches of configurable size
//   const BATCH_SIZE = parseInt(process.env.UNPAID_EMAIL_BATCH_SIZE || "10");
//   const BATCH_DELAY = parseInt(process.env.UNPAID_BATCH_DELAY_MS || "2000"); // 2 seconds default
//   const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

//   for (let i = 0; i < bookingsNeedingReminders.length; i += BATCH_SIZE) {
//     const batch = bookingsNeedingReminders.slice(i, i + BATCH_SIZE);
//     console.log(
//       `Processing batch ${Math.floor(i / BATCH_SIZE) + 1} of ${Math.ceil(
//         bookingsNeedingReminders.length / BATCH_SIZE
//       )}`
//     );

//     // Process emails in a batch in parallel
//     const emailPromises = batch.map(
//       async ({ booking, reminderLevel, hoursSinceCreation }) => {
//         try {
//           const customerEmail = booking.contact_email || booking.email;
//           const agentEmail = booking.Agent
//             ? booking.Agent.email
//             : booking.agent
//             ? booking.agent.email
//             : null;

//           console.log("🧠agentEmail,", agentEmail);

//           console.log(
//             `Processing booking ID: ${booking.id}, age: ${hoursSinceCreation}h, reminder level: ${reminderLevel}`
//           );

//           // Prepare booking details for email
//           const bookingDetails = {
//             ticket_id: booking.ticket_id,
//             booking_date: booking.booking_date,
//             created_at: booking.created_at, // Direct access to created_at
//             gross_total: booking.gross_total || booking.dataValues.amount,
//             currency: booking.currency || "USD",
//           };

//           console.log("BOOOKING DETAILS", bookingDetails);

//           // Send reminder email to customer
//           await sendUnpaidReminderEmail(
//             customerEmail,
//             bookingDetails,
//             reminderLevel
//           );

//           // If agent email exists, send reminder to agent as well
//           if (agentEmail) {
//             await sendUnpaidReminderEmailToAgent(
//               agentEmail,
//               customerEmail,
//               bookingDetails,
//               reminderLevel
//             );
//           }

//           console.log(
//             `✅ Reminder email #${reminderLevel} successfully sent to customer: ${customerEmail} and agent: ${
//               agentEmail || "N/A"
//             } for booking ID: ${booking.id}`
//           );
//           return { success: true, email: customerEmail };
//         } catch (error) {
//           console.error(
//             `❌ Failed to send email for booking ID: ${booking.id}`,
//             error
//           );
//           return {
//             success: false,
//             bookingId: booking.id,
//             error: error.message,
//           };
//         }
//       }
//     );

//     // Wait for all emails in the batch to complete
//     const results = await Promise.all(emailPromises);
//     console.log(
//       `Batch ${Math.floor(i / BATCH_SIZE) + 1} completed. ` +
//         `Success: ${results.filter((r) => r.success).length}, ` +
//         `Failed: ${results.filter((r) => !r.success).length}`
//     );

//     // Wait a moment before processing the next batch to avoid throttling
//     if (i + BATCH_SIZE < bookingsNeedingReminders.length) {
//       console.log(`Waiting ${BATCH_DELAY}ms before processing next batch...`);
//       await delay(BATCH_DELAY);
//     }
//   }
// }

// /**
//  * Function to cancel unpaid bookings that are past the cancellation hour
//  * @param {Array} bookingsToCancel - Array of bookings to cancel
//  */
// async function cancelUnpaidBookings(bookingsToCancel) {
//   console.log(
//     `✅ Starting process to cancel unpaid bookings > ${CANCELLATION_HOUR} hours...`
//   );

//   for (const booking of bookingsToCancel) {
//     try {
//       // 1. Release the reserved seats
//       await releaseSeats(booking);

//       // 2. Update booking status to 'cancelled'
//       booking.payment_status = "cancelled";
//       await booking.save();

//       // 3. Update related transaction status
//       const transaction = await Transaction.findOne({
//         where: { booking_id: booking.id, status: "unpaid" },
//       });

//       if (transaction) {
//         transaction.status = "cancelled";
//         await transaction.save();
//         console.log(
//           `Transaction ID ${transaction.transaction_id} has been canceled.`
//         );
//       }

//       // 4. Send cancellation notification to customer
//       const customerEmail = booking.contact_email;
//       if (customerEmail) {
//         await sendCancellationEmail(customerEmail, booking);
//       }

//       // 5. Send cancellation notification to agent with rebooking instructions
//       const agentEmail = booking.agent_email || booking.agent?.email;
//       if (agentEmail) {
//         await sendCancellationEmailToAgent(agentEmail, customerEmail, booking);
//       }

//       console.log(
//         `✅ Booking ID ${booking.id} (ticket ID: ${booking.ticket_id}) has been successfully canceled.`
//       );
//     } catch (error) {
//       console.error(`❌ Failed to cancel booking ID: ${booking.id}`, error);
//     }
//   }
// }

// // Function to release seats - using the same code from releaseSeats in cronJobs.js



// // Function to release seats - using the same code from releaseSeats in cronJobs.js
// const releaseSeats = async (booking, transaction) => {
//   const { schedule_id, subschedule_id, total_passengers, booking_date } =
//     booking;

//   console.log(`✅ STARTING RELEASE SEATS FOR BOOKING ID: ${booking.id}...`);

//   try {
//     // Import functions from other modules
//     const releaseMainScheduleSeats = require("../util/releaseMainScheduleSeats");
//     const releaseSubScheduleSeats = require("../util/releaseSubScheduleSeats");

//     if (subschedule_id) {
//       // If SubSchedule exists, return seats for SubSchedule
//       await releaseSubScheduleSeats(
//         schedule_id,
//         subschedule_id,
//         booking_date,
//         total_passengers,
//         transaction
//       );
//     } else {
//       // If Main Schedule, return seats for Main Schedule
//       await releaseMainScheduleSeats(
//         schedule_id,
//         booking_date,
//         total_passengers,
//         transaction
//       );
//     }

//     console.log(
//       `🎉Successfully released ${total_passengers} seats for Booking ID: ${booking.id}🎉`
//     );
//   } catch (error) {
//     console.error(
//       `Failed to release seats for Booking ID: ${booking.id}`,
//       error
//     );
//     throw error;
//   }
// };

// // Schedule cron job with configurable frequency
// const cronSchedule = process.env.UNPAID_REMINDER_CRON || "0 * * * *"; // Default: every hour
// cron.schedule(cronSchedule, async () => {
//   console.log(
//     `🕒 Running unpaid reminder cronjob with schedule: ${cronSchedule}`
//   );
//   await sendUnpaidReminders();
// });



