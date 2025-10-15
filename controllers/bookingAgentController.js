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
  //   AgentCommission,
  Agent,
  BookingSeatAvailability,
  Boat,
  Discount,
} = require("../models");
const { addTransportBookings, addPassengers } = require("../util/bookingUtil");
const { fn, col } = require("sequelize");
const nodemailer = require("nodemailer");
const { v4: uuidv4 } = require("uuid");
const handleMainScheduleBooking = require("../util/handleMainScheduleBooking");
const {
  updateAgentCommission,
  updateAgentCommissionOptimize,
} = require("../util/updateAgentComission");

const { mapJourneySteps } = require("../util/mapJourneySteps");

const { Op, where, literal } = require("sequelize");
const {
  calculateTicketTotal,
  validatePassengerCounts,
  generateOneWayTicketId,
} = require("../util/calculateTicketTotal");

const {
  handleSubScheduleBooking,
} = require("../util/handleSubScheduleBooking");

const cronJobs = require("../util/cronJobs");
const { createTransaction } = require("../util/transactionUtils");
const Queue = require("bull");
const bookingAgentQueue = new Queue("bookingAgentQueue"); // Inisialisasi Bull Queue

const { sendTelegramMessage } = require("../util/telegram");

const { createPayPalOrder } = require("../util/payment/paypal"); // PayPal utility
const { checkSeatAvailability } = require("../util/checkSeatNumber");
const {
  generateMidtransToken,
} = require("../util/payment/generateMidtransToken"); // MidTrans utility
const {
  handleMultipleSeatsBooking,
} = require("../util/handleMultipleSeatsBooking");
const validateSeatAvailability = require("../util/validateSeatAvailability");
const validateSeatAvailabilitySingleTrip = require("../util/validateSeatAvailabilitySingleTrip");
const AgentCommission = require("../models/AgentComission");
const { buildRouteFromSchedule } = require("../util/buildRoute");
const { findRelatedSubSchedules } = require("../util/handleSubScheduleBooking");
const {
  buildRouteFromSchedule2,
} = require("../util/schedulepassenger/buildRouteFromSchedule");
const { formatBookingsToText } = require("../util/bookingSummaryCron");

// / === AGENT BOOKING HANDLER ===
const createAgentBooking = async (req, res) => {
  const bookingData = req.body;

  console.log("Received agent booking data:", bookingData);
  try {
    // 1️⃣ Validate passenger counts
    validatePassengerCounts(
      bookingData.adult_passengers,
      bookingData.child_passengers,
      bookingData.infant_passengers || 0,
      bookingData.total_passengers
    );
    console.log("Step 1: Validate passenger counts");

    // 2️⃣ Calculate ticket total
    const ticketCalculation = await calculateTicketTotal(
      bookingData.schedule_id,
      bookingData.subschedule_id || null,
      bookingData.departure_date,
      bookingData.adult_passengers,
      bookingData.child_passengers,
      bookingData.infant_passengers || 0
    );
    console.log("Step 2: Calculate ticket total", ticketCalculation);

    if (!ticketCalculation.success) {
      return res.status(400).json({
        error: "Ticket calculation failed",
        message: ticketCalculation.error,
      });
    }

    console.log("Step 3: Ticket calculation success");

    const calculatedTicketTotal = ticketCalculation.ticketTotal;

    // 3️⃣ Generate unique ticket_id
    const ticket_id = await generateOneWayTicketId();
    console.log("Step 4: Generated ticket ID", ticket_id);

    // 4️⃣ Safety check for duplicates
    const existingBooking = await Booking.findOne({ where: { ticket_id } });
    if (existingBooking) {
      return res.status(400).json({
        error: "Ticket ID already exists",
        message: `The ticket ID '${ticket_id}' is already in use.`,
      });
    }
    console.log("Step 5: Ticket ID is unique");

    // 5️⃣ Calculate transport total & gross total

    const transportTotal = Array.isArray(bookingData.transports)
      ? bookingData.transports.reduce(
          (total, t) =>
            total + (parseFloat(t.transport_price) || 0) * (t.quantity || 1),
          0
        )
      : 0;

    const grossTotal = (Number(calculatedTicketTotal) || 0) + transportTotal;

    console.log("Step 6: Calculated transport and gross totals", {
      transportTotal,
      grossTotal,
    });

    // 6️⃣ Create booking + transaction
    const result = await sequelize.transaction(async (t) => {
      const seatAvailabilityResult = await validateSeatAvailabilitySingleTrip(
        bookingData.schedule_id,
        bookingData.subschedule_id,
        bookingData.departure_date,
        bookingData.total_passengers
      );

      console.log("Step 7: Seat availability result", seatAvailabilityResult);

      if (!seatAvailabilityResult.success) {
        throw new Error(seatAvailabilityResult.message);
      }

      const booking = await Booking.create(
        {
          ...bookingData,
          booking_date: bookingData.departure_date, // Map departure_date to booking_date column
          ticket_id,
          ticket_total: calculatedTicketTotal,
          gross_total: grossTotal,
          payment_status: "invoiced",
          payment_method: "invoiced",
          booking_source: "agent",
          expiration_time: new Date(
            Date.now() + (process.env.EXPIRATION_TIME_MINUTES || 30) * 60000
          ),
        },
        { transaction: t }
      );
      console.log("Step 8: Created booking record", booking.id);

      const shortTransactionId = uuidv4().replace(/-/g, "").substring(0, 16);
      const transactionEntry = await createTransaction(
        {
          transaction_id: `TRANS-${shortTransactionId}`,
          payment_method: "invoiced",
          payment_gateway: null,
          amount: grossTotal,
          currency: bookingData.currency || "IDR",
          transaction_type: bookingData.transaction_type || "booking",
          booking_id: booking.id,
          status: "success",
        },
        t
      );
      console.log(
        "Step 9: Created transaction record",
        transactionEntry.transaction_id
      );
  console.log(
        "Step 10: Created transaction record",
        transactionEntry.transaction_id
      );


      // 💰 Langsung hitung dan buat agent commission
      let commissionResult = null;
      if (bookingData.agent_id) {
        const agent = await Agent.findByPk(bookingData.agent_id, {
          transaction: t,
        });
        if (agent) {
          // Dapatkan trip type
          let tripType = null;
          if (bookingData.subschedule_id) {
            const sub = await SubSchedule.findByPk(bookingData.subschedule_id);
            tripType = sub ? sub.trip_type : null;
          } else {
            const sch = await Schedule.findByPk(bookingData.schedule_id);
            tripType = sch ? sch.trip_type : null;
          }

          if (tripType) {
            const transportBookings = bookingData.transports || [];
            commissionResult = await updateAgentCommissionOptimize(
              bookingData.agent_id,
              grossTotal,
              bookingData.total_passengers,
              "invoiced", // payment_status
              bookingData.schedule_id,
              bookingData.subschedule_id,
              booking.id,
              t,
              transportBookings,
              tripType,
              agent
            );

            console.log(
              commissionResult.success
                ? `✅ Commission created for agent   ${bookingData.agent_id} with payment method ${bookingData.payment_method}: ${commissionResult.commission}`
                : `ℹ️ Commission already exists for agent ${bookingData.agent_id}`
            );
          } else {
            console.warn("⚠️ Trip type missing; skipping commission.");
          }
        } else {
          console.warn(`⚠️ Agent not found with ID ${bookingData.agent_id}`);
        }
      }

      // 7️⃣ Queue for background processing (seat + transport)
      bookingAgentQueue.add({
        schedule_id: bookingData.schedule_id,
        subschedule_id: bookingData.subschedule_id,
        departure_date: bookingData.departure_date,
        total_passengers: bookingData.total_passengers,
        transports: bookingData.transports,
        booking_id: booking.id,
        agent_id: bookingData.agent_id,
        gross_total: grossTotal,
        payment_status: "invoiced",
      });
      console.log("Step 10: Added booking to processing queue");
      return { booking, transactionEntry, commissionResult };
    });

    return res.status(201).json({
      success: true,
      message: "Agent booking created successfully",
      data: {
        booking_id: result.booking.id,
        ticket_id,
        transaction_id: result.transactionEntry.transaction_id,
        ticket_total: calculatedTicketTotal,
        transport_total: transportTotal,
        gross_total: grossTotal,
        payment_status: "invoiced",
        payment_method: "invoiced",
        status: "processing",
        pricing_breakdown: ticketCalculation.breakdown,
        schedule_info: ticketCalculation.scheduleInfo,
        commission: result.commissionResult,

      },
    });
  } catch (error) {
    console.error("Agent booking error:", error.message);
    return res.status(500).json({
      error: "Internal server error",
      message: error.message,
    });
  }
};

// === BOOKING QUEUE HANDLER ===
bookingAgentQueue.process(async (job, done) => {
  const {
    schedule_id,
    subschedule_id,
    departure_date,
    total_passengers,
    transports,
    booking_id,
    agent_id,
    gross_total,
    payment_status,
  } = job.data;

  console.log("🔄 Processing Agent Booking Queue:", job.data);

  const transaction = await sequelize.transaction();
  try {
    let remainingSeatAvailabilities;

    if (subschedule_id) {
      console.log(`🧩 Handling sub-schedule booking (${subschedule_id})`);
      remainingSeatAvailabilities = await handleSubScheduleBooking(
        schedule_id,
        subschedule_id,
        departure_date,
        total_passengers,
        transaction
      );
    } else {
      console.log(`🚤 Handling main schedule booking (${schedule_id})`);
      remainingSeatAvailabilities = await handleMainScheduleBooking(
        schedule_id,
        departure_date,
        total_passengers,
        transaction
      );
    }

    if (remainingSeatAvailabilities?.length > 0) {
      const bookingSeatAvailabilityData = remainingSeatAvailabilities.map(
        (sa) => ({
          booking_id,
          seat_availability_id: sa.id,
        })
      );

      await BookingSeatAvailability.bulkCreate(bookingSeatAvailabilityData, {
        transaction,
      });

      console.log(
        `✅ Linked ${bookingSeatAvailabilityData.length} seat availabilities`
      );
    }

    if (transports?.length > 0) {
      await addTransportBookings(transports, booking_id, total_passengers, transaction);
    }

    await transaction.commit();
    console.log(`🎉 Queue completed for agent booking ${booking_id}`);
    done();
  } catch (error) {
    await transaction.rollback();
    console.error(`❌ Agent booking queue error: ${error.message}`);

    sendTelegramMessage(`
❌ <b>[AGENT BOOKING QUEUE ERROR]</b>
<pre>${error.message}</pre>
🧾 Booking ID: <code>${booking_id}</code>
📅 Departure Date: <code>${departure_date}</code>
🕒 ${new Date().toLocaleString()}
    `);

    done(error);
  }
});

// const createAgentBooking = async (req, res) => {
//   const bookingData = req.body;

//   try {
//     // 1. Validate passenger counts
//     validatePassengerCounts(
//       bookingData.adult_passengers,
//       bookingData.child_passengers,
//       bookingData.infant_passengers || 0,
//       bookingData.total_passengers
//     );

//     // 2. Calculate ticket total from backend based on schedule prices
//     const ticketCalculation = await calculateTicketTotal(
//       bookingData.schedule_id,
//       bookingData.subschedule_id || null, // Handle null/undefined subschedule_id
//       bookingData.booking_date,
//       bookingData.adult_passengers,
//       bookingData.child_passengers,
//       bookingData.infant_passengers || 0
//     );

//     if (!ticketCalculation.success) {
//       return res.status(400).json({
//         error: "Ticket calculation failed",
//         message: ticketCalculation.error,
//       });
//     }

//     const calculatedTicketTotal = ticketCalculation.ticketTotal;

//     // 3. Generate ticket ID
//     const ticket_id = await generateAgentTicketId();

//     // 4. Check for duplicate ticket (extra safety)
//     const existingBooking = await Booking.findOne({ where: { ticket_id } });
//     if (existingBooking) {
//       return res.status(400).json({
//         error: "Ticket ID collision",
//         message: "Please try again",
//       });
//     }

//     // 5. Calculate transport totals
//     const { transportTotal } = calculateTotals(bookingData.transports);
//     const grossTotal = calculatedTicketTotal + transportTotal;

//     // 6. Process booking in transaction
//     const result = await sequelize.transaction(async (t) => {
//       // Validate seat availability
//       const seatAvailabilityResult = await validateSeatAvailabilitySingleTrip(
//         bookingData.schedule_id,
//         bookingData.subschedule_id,
//         bookingData.booking_date,
//         bookingData.total_passengers
//       );

//       if (!seatAvailabilityResult.success) {
//         throw new Error(seatAvailabilityResult.message);
//       }

//       // Create booking record
//       const booking = await Booking.create(
//         {
//           ...bookingData,
//           ticket_id,
//           ticket_total: calculatedTicketTotal, // Use calculated ticket total
//           gross_total: grossTotal,
//           payment_status: "invoiced",
//           payment_method: "invoiced",
//           booking_source: "agent",
//           expiration_time: new Date(
//             Date.now() + (process.env.EXPIRATION_TIME_MINUTES || 30) * 60000
//           ),
//         },
//         { transaction: t }
//       );

//       // Create transaction record
//       const shortTransactionId = uuidv4().replace(/-/g, "").substring(0, 16);
//       const transactionEntry = await createTransaction(
//         {
//           transaction_id: `TRANS-${shortTransactionId}`,
//           payment_method: "invoiced",
//           payment_gateway: null,
//           amount: grossTotal,
//           currency: bookingData.currency || "IDR",
//           transaction_type: bookingData.transaction_type || "booking",
//           booking_id: booking.id,
//           status: "success",
//         },
//         t
//       );

//       // Add to processing queue
//       bookingQueue.add({
//         ...bookingData,
//         booking_id: booking.id,
//         ticket_total: calculatedTicketTotal,
//         gross_total: grossTotal,
//         ticket_id,
//         payment_status: "invoiced",
//       });

//       return {
//         booking,
//         transaction: transactionEntry,
//         ticket_id,
//         ticketCalculation,
//       };
//     });

//     return res.status(201).json({
//       success: true,
//       message: "Agent booking created successfully",
//       data: {
//         booking_id: result.booking.id,
//         ticket_id: result.ticket_id,
//         transaction_id: result.transaction.transaction_id,
//         ticket_total: calculatedTicketTotal,
//         transport_total: transportTotal,
//         gross_total: grossTotal,
//         payment_status: "invoiced",
//         status: "processing",
//         pricing_breakdown: result.ticketCalculation.breakdown,
//         schedule_info: result.ticketCalculation.scheduleInfo,
//       },
//     });
//   } catch (error) {
//     console.error("Agent booking error:", error.message);

//     // Handle specific error types
//     if (error.name === "SequelizeValidationError") {
//       return res.status(400).json({
//         error: "Validation error",
//         message: error.message,
//       });
//     }

//     if (error.name === "SequelizeUniqueConstraintError") {
//       return res.status(400).json({
//         error: "Duplicate data",
//         message: error.message,
//       });
//     }

//     return res.status(500).json({
//       error: "Internal server error",
//       message: error.message,
//     });
//   }
// };

module.exports = {
  createAgentBooking,
};
