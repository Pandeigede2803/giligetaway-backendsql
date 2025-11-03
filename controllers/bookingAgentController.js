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
  generateAgentRoundTripTicketId,
} = require("../util/calculateTicketTotal");

const {
  handleSubScheduleBooking,
} = require("../util/handleSubScheduleBooking");

const cronJobs = require("../util/cronJobs");
const { createTransaction } = require("../util/transactionUtils");
const Queue = require("bull");
const bookingAgentQueue = new Queue("bookingAgentQueue"); // Inisialisasi Bull Queue
const bookingAgentRoundQueue = new Queue("bookingAgentRoundQueue");
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
const {
  sendEmailApiAgentStaff,
  sendEmailApiRoundTripAgentStaff,
} = require("../util/sendPaymentEmailApiAgent");

// ===============================
// ✅ HELPER FUNCTIONS
// ===============================

/**
 * Calculate transport totals from transport array
 */
const calculateTotals = (transports = []) => {
  const transportTotal = Array.isArray(transports)
    ? transports.reduce(
        (total, t) =>
          total + (parseFloat(t.transport_price) || 0) * (t.quantity || 1),
        0
      )
    : 0;

  return { transportTotal };
};

/**
 * Send Telegram notification for queue errors
 */
const notifyQueueError = (error, context, title) => {
  sendTelegramMessage(`
❌ <b>[${title}]</b>
<pre>${error.message}</pre>
🧾 Booking ID: <code>${context.booking_id || "N/A"}</code>
📅 Booking Date: <code>${context.booking_date || "N/A"}</code>
🛤️ Schedule: <code>${context.schedule_id || "N/A"}</code>
🔀 SubSchedule: <code>${context.subschedule_id || "N/A"}</code>
🔖 Type: <code>${context.type || "N/A"}</code>
🕒 ${new Date().toLocaleString()}
  `);
};

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
                ? `✅ Step 10: Commission created for agent ${bookingData.agent_id} with payment method ${bookingData.payment_method}: ${commissionResult.commission}`
                : `ℹ️ Step 10: Commission already exists for agent ${bookingData.agent_id}`
            );
          } else {
            console.warn("⚠️ Step 10: Trip type missing; skipping commission.");
          }
        } else {
          console.warn(`⚠️ Step 10: Agent not found with ID ${bookingData.agent_id}`);
        }
      }

      // 🔄 Queue for background processing (seat + transport + passengers + email)
      bookingAgentQueue.add({
        schedule_id: bookingData.schedule_id,
        subschedule_id: bookingData.subschedule_id,
        departure_date: bookingData.departure_date,
        total_passengers: bookingData.total_passengers,
        transports: bookingData.transports,
        passengers: bookingData.passengers,
        booking_id: booking.id,
        agent_id: bookingData.agent_id,
        agent_email: bookingData.agent_email,
        gross_total: grossTotal,
        payment_status: "invoiced",
        commission_amount: commissionResult?.commission || 0,
        transportTotal: transportTotal,
      });
      console.log("Step 11: Added booking to processing queue");
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
    passengers,
    booking_id,
    agent_email,
    commission_amount,
    transportTotal
  } = job.data;

  console.log("🔄 Processing Agent Booking Queue:", job.data);

  const transaction = await sequelize.transaction();
  try {
    // 1️⃣ Handle seat availability
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

    // 2️⃣ Add transport bookings
    if (transports?.length > 0) {
      await addTransportBookings(transports, booking_id, total_passengers, transaction);
    }

    // 3️⃣ Add passengers
    if (passengers && passengers.length > 0) {
      await addPassengers(passengers, booking_id, transaction);
      console.log(`✅ Added ${passengers.length} passengers`);
    }

    await transaction.commit();
    console.log(`🎉 Queue completed for agent booking ${booking_id}`);

    // 4️⃣ Send email (after transaction commit, non-blocking)
    try {
      const bookingWithDetails = await Booking.findByPk(booking_id, {
        include: [
          { model: Agent, as: "Agent" },
          { model: Passenger, as: "passengers" },
          { model: TransportBooking, as: "transportBookings" },
        ],
      });

      // Attach commission and transport total from queue data instead of querying
      bookingWithDetails.totalCommission = commission_amount;
      bookingWithDetails.transportTotal = transportTotal;

      // Fetch schedule with destinations separately if needed
      if (bookingWithDetails && bookingWithDetails.schedule_id) {
        bookingWithDetails.schedule = await Schedule.findByPk(bookingWithDetails.schedule_id, {
          include: [
            { model: Boat, as: "Boat" },
            {
              model: Transit,
              as: "Transits",
              include: [{ model: Destination, as: "Destination" }],
            },
            { model: Destination, as: "FromDestination" },
            { model: Destination, as: "ToDestination" },
          ]
        });
      }

      // Fetch subschedule with transits separately if needed
      if (bookingWithDetails && bookingWithDetails.subschedule_id) {
        bookingWithDetails.subSchedule = await SubSchedule.findByPk(bookingWithDetails.subschedule_id, {
          include: [
            { model: Destination, as: "DestinationFrom" },
            {
              model: Schedule,
              as: "Schedule",
              attributes: [
                "id",
                "arrival_time",
                "departure_time",
                "journey_time",
              ],
            },
            { model: Destination, as: "DestinationTo" },
            {
              model: Transit,
              as: "TransitFrom",
              include: [{ model: Destination, as: "Destination" }],
            },
            {
              model: Transit,
              as: "TransitTo",
              include: [{ model: Destination, as: "Destination" }],
            },
            {
              model: Transit,
              as: "Transit1",
              include: [{ model: Destination, as: "Destination" }],
            },
            {
              model: Transit,
              as: "Transit2",
              include: [{ model: Destination, as: "Destination" }],
            },
            {
              model: Transit,
              as: "Transit3",
              include: [{ model: Destination, as: "Destination" }],
            },
            {
              model: Transit,
              as: "Transit4",
              include: [{ model: Destination, as: "Destination" }],
            },
          ]
        });
      }

      if (bookingWithDetails) {
        await sendEmailApiAgentStaff(
          process.env.EMAIL_AGENT,
          bookingWithDetails,
          bookingWithDetails.Agent?.name || "Unknown Agent",
          bookingWithDetails.Agent?.email || agent_email
        );
        console.log("✅ Email notification sent successfully");
      }
    } catch (emailError) {
      console.error("⚠️ Email sending failed:", emailError.message);
      // Don't fail the queue if email fails
    }

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

// controllers/agentRoundTripBookingController.js

// ===============================
// ✅ CREATE ROUND-TRIP BOOKING FOR AGENT
// ===============================
const createAgentRoundTripBooking = async (req, res) => {
  const { departure, return: returnData } = req.body;

  try {
    const result = await sequelize.transaction(async (t) => {
      // 1️⃣ Generate ticket ID pair ONCE for both legs
      const ticketPair = await generateAgentRoundTripTicketId();

      console.log(`🎫 Generated ticket pair: ${ticketPair.ticket_id_departure} & ${ticketPair.ticket_id_return}`);

      // Helper to process each leg (departure / return)
      const handleLeg = async (data, type, ticket_id) => {
        validatePassengerCounts(
          data.adult_passengers,
          data.child_passengers,
          data.infant_passengers || 0,
          data.total_passengers
        );

        // 2️⃣ Calculate backend ticket price
        const ticketCalculation = await calculateTicketTotal(
          data.schedule_id,
          data.subschedule_id || null,
          data.booking_date,
          data.adult_passengers,
          data.child_passengers,
          data.infant_passengers || 0
        );

        if (!ticketCalculation.success) {
          throw new Error(
            `[${type}] Ticket calculation failed: ${ticketCalculation.error}`
          );
        }

        const ticket_total = ticketCalculation.ticketTotal;

        // 3️⃣ Check duplication (should not happen, but safety check)
        const existing = await Booking.findOne({ where: { ticket_id } });
        if (existing) throw new Error(`[${type}] Ticket ID collision`);

        // 4️⃣ Validate seat availability
        const seatAvailability = await validateSeatAvailabilitySingleTrip(
          data.schedule_id,
          data.subschedule_id,
          data.booking_date,
          data.total_passengers
        );
        if (!seatAvailability.success)
          throw new Error(`[${type}] ${seatAvailability.message}`);

        // 5️⃣ Compute totals
        const { transportTotal } = calculateTotals(data.transports);
        const gross_total = ticket_total + transportTotal;

        // 6️⃣ Create booking
        const booking = await Booking.create(
          {
            ...data,
            ticket_id,
            ticket_total,
            gross_total,
            payment_status: "invoiced",
            payment_method: "invoiced",
            booking_source: "agent",
            expiration_time: new Date(
              Date.now() + (process.env.EXPIRATION_TIME_MINUTES || 30) * 60000
            ),
          },
          { transaction: t }
        );;

        // 7️⃣ Create transaction
        const shortTxId = uuidv4().replace(/-/g, "").substring(0, 16);
        const transactionEntry = await createTransaction(
          {
            transaction_id: `TRANS-${shortTxId}`,
            payment_method: "invoiced",
            payment_gateway: null,
            amount: gross_total,
            currency: data.currency || "IDR",
            transaction_type: data.transaction_type || "booking",
            booking_id: booking.id,
            status: "success",
          },
          t
        );

        // 8️⃣ Add passengers directly
        await addPassengers(data.passengers, booking.id, t);

        // 9️⃣ Generate Agent Commission
        let commissionResult = null;
        if (data.agent_id) {
          const agent = await Agent.findByPk(data.agent_id, { transaction: t });
          if (agent) {
            let tripType = null;
            if (data.subschedule_id) {
              const sub = await SubSchedule.findByPk(data.subschedule_id);
              tripType = sub ? sub.trip_type : null;
            } else {
              const sch = await Schedule.findByPk(data.schedule_id);
              tripType = sch ? sch.trip_type : null;
            }

            if (tripType) {
              const transportBookings = data.transports || [];
              commissionResult = await updateAgentCommissionOptimize(
                data.agent_id,
                gross_total,
                data.total_passengers,
                "invoiced",
                data.schedule_id,
                data.subschedule_id,
                booking.id,
                t,
                transportBookings,
                tripType,
                agent
              );

              console.log(
                commissionResult.success
                  ? `✅ Commission created for agent ${data.agent_id} [${type}]: ${commissionResult.commission}`
                  : `ℹ️ Commission already exists for agent ${data.agent_id} [${type}]`
              );
            } else {
              console.warn(`⚠️ Trip type missing for ${type}; skipping commission.`);
            }
          } else {
            console.warn(`⚠️ Agent not found with ID ${data.agent_id}`);
          }
        }

        // 🔟 Add to queue for heavy operations
        bookingAgentRoundQueue.add({
          schedule_id: data.schedule_id,
          subschedule_id: data.subschedule_id,
          booking_date: data.booking_date,
          total_passengers: data.total_passengers,
          transports: data.transports,
          passengers: data.passengers,
          booking_id: booking.id,
          agent_id: data.agent_id,
          agent_email: data.agent_email,
          ticket_total,
          gross_total,
          ticket_id,
          payment_status: "invoiced",
          type,
          commission_amount: commissionResult?.commission || 0,
        });

        return { booking, transaction: transactionEntry, ticketCalculation, commission: commissionResult };
      };

      // 🚤 Process both legs with their respective ticket IDs
      const departureResult = await handleLeg(departure, "departure", ticketPair.ticket_id_departure);
      const returnResult = await handleLeg(returnData, "return", ticketPair.ticket_id_return);

      return { departure: departureResult, return: returnResult };
    });

    const totalGross =
      result.departure.booking.gross_total +
      result.return.booking.gross_total;

    return res.status(201).json({
      success: true,
      message: "Agent round-trip booking created successfully",
      data: {
        departure: {
          booking_id: result.departure.booking.id,
          ticket_id: result.departure.booking.ticket_id,
          transaction_id: result.departure.transaction.transaction_id,
          ticket_total: result.departure.booking.ticket_total,
          gross_total: result.departure.booking.gross_total,
          pricing_breakdown: result.departure.ticketCalculation.breakdown,
          commission: result.departure.commission,
        },
        return: {
          booking_id: result.return.booking.id,
          ticket_id: result.return.booking.ticket_id,
          transaction_id: result.return.transaction.transaction_id,
          ticket_total: result.return.booking.ticket_total,
          gross_total: result.return.booking.gross_total,
          pricing_breakdown: result.return.ticketCalculation.breakdown,
          commission: result.return.commission,
        },
        total_gross: totalGross,
        payment_status: "invoiced",
        status: "processing",
      },
    });
  } catch (error) {
    console.error("❌ Agent round-trip booking error:", error.message);

    if (
      error.name === "SequelizeValidationError" ||
      error.name === "SequelizeUniqueConstraintError"
    ) {
      return res.status(400).json({
        error: "Validation error",
        message: error.message,
      });
    }

    return res.status(500).json({
      error: "Internal server error",
      message: error.message,
    });
  }
};

// Track round-trip completion status
const roundTripCompletionMap = new Map();

bookingAgentRoundQueue.process(async (job, done) => {
  const {
    schedule_id,
    subschedule_id,
    booking_date,
    total_passengers,
    transports,
    passengers,
    booking_id,
    agent_email,
    ticket_id,
    type,
    commission_amount,
  } = job.data;

  console.log(`\n[Queue] 🌀 Processing ${type.toUpperCase()} booking ID ${booking_id}`);

  const transaction = await sequelize.transaction();

  try {
    // 1️⃣ Seat Availability
    let remainingSeatAvailabilities;
    if (subschedule_id) {
      remainingSeatAvailabilities = await handleSubScheduleBooking(
        schedule_id,
        subschedule_id,
        booking_date,
        total_passengers,
        transaction
      );
    } else {
      remainingSeatAvailabilities = await handleMainScheduleBooking(
        schedule_id,
        booking_date,
        total_passengers,
        transaction
      );
    }

    // 2️⃣ Pivot BookingSeatAvailability
    if (remainingSeatAvailabilities && remainingSeatAvailabilities.length > 0) {
      const pivotData = remainingSeatAvailabilities.map((sa) => ({
        booking_id,
        seat_availability_id: sa.id,
      }));

      await BookingSeatAvailability.bulkCreate(pivotData, { transaction });
      console.log(
        `✅ ${pivotData.length} BookingSeatAvailability linked for booking ${booking_id}`
      );
    } else {
      console.log(`⚠️ No seat availability found for booking ${booking_id}`);
    }

    // 3️⃣ Add Transport Bookings
    if (transports && transports.length > 0) {
      await addTransportBookings(
        transports,
        booking_id,
        total_passengers,
        transaction
      );
      console.log(`🚐 Transport bookings added for booking ${booking_id}`);
    }

    // 4️⃣ Add passengers
    if (passengers && passengers.length > 0) {
      await addPassengers(passengers, booking_id, transaction);
      console.log(`✅ Added ${passengers.length} passengers for ${type}`);
    }

    await transaction.commit();
    console.log(`🎉 Agent round-trip queue success for booking ${booking_id}`);

    // 5️⃣ Track completion and send email when BOTH legs are done
    const baseTicketId = ticket_id.replace(/-(DEP|RET)$/, '');

    if (!roundTripCompletionMap.has(baseTicketId)) {
      roundTripCompletionMap.set(baseTicketId, {
        [type]: booking_id,
        [`${type}_commission`]: commission_amount
      });
      console.log(`📝 Tracking ${type} for ticket ${baseTicketId}`);
    } else {
      const existingData = roundTripCompletionMap.get(baseTicketId);
      existingData[type] = booking_id;
      existingData[`${type}_commission`] = commission_amount;

      // Check if both departure and return are completed
      if (existingData.departure && existingData.return) {
        console.log(`✅ Both legs completed for ${baseTicketId}, sending email...`);

        try {
          const departureBooking = await Booking.findByPk(existingData.departure, {
            include: [
              { model: Agent, as: "Agent" },
              { model: Passenger, as: "passengers" },
              { model: TransportBooking, as: "transportBookings" },
            ],
          });

          const returnBooking = await Booking.findByPk(existingData.return, {
            include: [
              { model: Agent, as: "Agent" },
              { model: Passenger, as: "passengers" },
              { model: TransportBooking, as: "transportBookings" },
            ],
          });

          // Attach commission from tracked data
          departureBooking.totalCommission = existingData.departure_commission || 0;
          returnBooking.totalCommission = existingData.return_commission || 0;

          // Fetch schedule/subschedule details separately to avoid association conflicts
          if (departureBooking && departureBooking.schedule_id) {
            departureBooking.schedule = await Schedule.findByPk(departureBooking.schedule_id, {
              include: [
                { model: Boat, as: "Boat" },
                {
                  model: Transit,
                  as: "Transits",
                  include: [{ model: Destination, as: "Destination" }],
                },
                { model: Destination, as: "FromDestination" },
                { model: Destination, as: "ToDestination" },
              ]
            });
          }

          if (departureBooking && departureBooking.subschedule_id) {
            departureBooking.subSchedule = await SubSchedule.findByPk(departureBooking.subschedule_id, {
              include: [
                { model: Destination, as: "DestinationFrom" },
                {
                  model: Schedule,
                  as: "Schedule",
                  attributes: [
                    "id",
                    "arrival_time",
                    "departure_time",
                    "journey_time",
                  ],
                },
                { model: Destination, as: "DestinationTo" },
                {
                  model: Transit,
                  as: "TransitFrom",
                  include: [{ model: Destination, as: "Destination" }],
                },
                {
                  model: Transit,
                  as: "TransitTo",
                  include: [{ model: Destination, as: "Destination" }],
                },
                {
                  model: Transit,
                  as: "Transit1",
                  include: [{ model: Destination, as: "Destination" }],
                },
                {
                  model: Transit,
                  as: "Transit2",
                  include: [{ model: Destination, as: "Destination" }],
                },
                {
                  model: Transit,
                  as: "Transit3",
                  include: [{ model: Destination, as: "Destination" }],
                },
                {
                  model: Transit,
                  as: "Transit4",
                  include: [{ model: Destination, as: "Destination" }],
                },
              ]
            });
          }

          if (returnBooking && returnBooking.schedule_id) {
            returnBooking.schedule = await Schedule.findByPk(returnBooking.schedule_id, {
              include: [
                { model: Boat, as: "Boat" },
                {
                  model: Transit,
                  as: "Transits",
                  include: [{ model: Destination, as: "Destination" }],
                },
                { model: Destination, as: "FromDestination" },
                { model: Destination, as: "ToDestination" },
              ]
            });
          }

          if (returnBooking && returnBooking.subschedule_id) {
            returnBooking.subSchedule = await SubSchedule.findByPk(returnBooking.subschedule_id, {
              include: [
                { model: Destination, as: "DestinationFrom" },
                {
                  model: Schedule,
                  as: "Schedule",
                  attributes: [
                    "id",
                    "arrival_time",
                    "departure_time",
                    "journey_time",
                  ],
                },
                { model: Destination, as: "DestinationTo" },
                {
                  model: Transit,
                  as: "TransitFrom",
                  include: [{ model: Destination, as: "Destination" }],
                },
                {
                  model: Transit,
                  as: "TransitTo",
                  include: [{ model: Destination, as: "Destination" }],
                },
                {
                  model: Transit,
                  as: "Transit1",
                  include: [{ model: Destination, as: "Destination" }],
                },
                {
                  model: Transit,
                  as: "Transit2",
                  include: [{ model: Destination, as: "Destination" }],
                },
                {
                  model: Transit,
                  as: "Transit3",
                  include: [{ model: Destination, as: "Destination" }],
                },
                {
                  model: Transit,
                  as: "Transit4",
                  include: [{ model: Destination, as: "Destination" }],
                },
              ]
            });
          }

          if (departureBooking && returnBooking) {
            await sendEmailApiRoundTripAgentStaff(
              process.env.EMAIL_AGENT,
              departureBooking,
              returnBooking,
              departureBooking.Agent?.name || "Unknown Agent",
              departureBooking.Agent?.email || agent_email
            );
            console.log("✅ Round-trip email notification sent successfully");
          }

          // Clean up tracking
          roundTripCompletionMap.delete(baseTicketId);
        } catch (emailError) {
          console.error("⚠️ Round-trip email sending failed:", emailError.message);
        }
      }
    }

    done();
  } catch (error) {
    await transaction.rollback();
    console.error(`❌ Queue error for booking ${booking_id}:`, error.message);

    notifyQueueError(
      error,
      {
        booking_id,
        booking_date,
        schedule_id,
        subschedule_id,
        type,
      },
      "BOOKING ROUND QUEUE ERROR"
    );

    done(error);
  }
});

module.exports = {
  createAgentBooking,createAgentRoundTripBooking
};
