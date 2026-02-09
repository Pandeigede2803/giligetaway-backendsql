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
  calculateAgentCommissionAmount,
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


const {
  generateMidtransToken,
} = require("../util/payment/generateMidtransToken"); // MidTrans utility
const getExchangeRate = require("../util/getExchangeRate");
const {
  handleMultipleSeatsBooking,
} = require("../util/handleMultipleSeatsBooking");
const validateSeatAvailability = require("../util/validateSeatAvailability");
const validateSeatAvailabilitySingleTrip = require("../util/validateSeatAvailabilitySingleTripSafe");
const AgentCommission = require("../models/AgentComission");

const {
  buildRouteFromSchedule2,
} = require("../util/schedulepassenger/buildRouteFromSchedule");
const { formatBookingsToText } = require("../util/bookingSummaryCron");
const {
  sendEmailApiAgentStaff,
  sendEmailApiRoundTripAgentStaff,
  sendAgentBookingSuccessEmail,
} = require("../util/sendPaymentEmailApiAgent");
const { autoAssignSeatsForBooking } = require("../util/autoAssignSeats");

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
 * Calculate discount and apply to net total (after commission deduction)
 * IMPORTANT: Discount is calculated from NET amount (ticket_total - commission), NOT from ticket_total
 * @param {Object} discount - Discount object from database
 * @param {number} ticketTotal - Original ticket total before any deductions
 * @param {number} commissionAmount - Agent commission amount to deduct first
 * @param {number} scheduleId - Schedule ID to validate
 * @param {string} direction - 'departure', 'return', or 'all'
 * @returns {Object} { discountAmount, finalTotal, discountData, netAfterCommission }
 */
const calculateDiscountAmount = (discount, ticketTotal, commissionAmount = 0, scheduleId, direction = 'all') => {
  // Calculate net amount after commission deduction
  const netAfterCommission = ticketTotal - commissionAmount;

  if (!discount) {
    console.log("❌ Discount validation failed: No discount object provided");
    return {
      discountAmount: 0,
      finalTotal: ticketTotal,
      discountData: null,
      netAfterCommission
    };
  }

  // Validate schedule_id if discount has specific schedule restrictions
  if (Array.isArray(discount.schedule_ids) && discount.schedule_ids.length > 0) {
    if (!discount.schedule_ids.includes(parseInt(scheduleId))) {
      console.log("❌ Discount validation failed: Schedule ID not in allowed list", {
        scheduleId,
        allowedScheduleIds: discount.schedule_ids
      });
      return {
        discountAmount: 0,
        finalTotal: ticketTotal,
        discountData: null,
        netAfterCommission
      };
    }
  }

  // Validate direction
  if (discount.applicable_direction !== 'all' && discount.applicable_direction !== direction) {
    console.log("❌ Discount validation failed: Direction mismatch", {
      requiredDirection: discount.applicable_direction,
      providedDirection: direction
    });
    return {
      discountAmount: 0,
      finalTotal: ticketTotal,
      discountData: null,
      netAfterCommission
    };
  }

  // Check minimum purchase requirement (based on net after commission)
  if (discount.min_purchase && netAfterCommission < parseFloat(discount.min_purchase)) {
    console.log("❌ Discount validation failed: Minimum purchase not met", {
      minPurchase: discount.min_purchase,
      netAfterCommission
    });
    return {
      discountAmount: 0,
      finalTotal: ticketTotal,
      discountData: null,
      netAfterCommission
    };
  }

  let discountAmount = 0;

  // Calculate discount based on type - FROM NET AFTER COMMISSION
  if (discount.discount_type === 'percentage') {
    console.log("📊 Calculating percentage discount from NET (after commission):", {
      ticketTotal,
      commissionAmount,
      netAfterCommission,
      discountValue: discount.discount_value,
      discountValueParsed: parseFloat(discount.discount_value),
      calculation: `(${netAfterCommission} * ${parseFloat(discount.discount_value)}) / 100`
    });

    // IMPORTANT: Discount is calculated from netAfterCommission, NOT ticketTotal
    discountAmount = (netAfterCommission * parseFloat(discount.discount_value)) / 100;

    console.log("📊 After calculation:", {
      discountAmount,
      maxDiscount: discount.max_discount
    });

    // Apply max_discount cap if set (only if max_discount is greater than 0)
    const maxDiscountValue = parseFloat(discount.max_discount);
    if (discount.max_discount && maxDiscountValue > 0 && discountAmount > maxDiscountValue) {
      console.log("🔒 Applying max_discount cap");
      discountAmount = maxDiscountValue;
    }
  } else if (discount.discount_type === 'fixed') {
    discountAmount = parseFloat(discount.discount_value);
  }

  // Final total = ticket_total - discount (commission is separate, not deducted from final)
  const finalTotal = Math.max(0, ticketTotal - discountAmount);

  // Prepare discount_data JSON for storing in booking
  const discountData = {
    discountId: discount.id.toString(),
    discountValue: parseFloat(discountAmount.toFixed(2)),
    discountPercentage: discount.discount_type === 'percentage' ? discount.discount_value.toString() : "0",
    calculatedFromNet: parseFloat(netAfterCommission.toFixed(2)),
    commissionDeducted: parseFloat(commissionAmount.toFixed(2))
  };

  console.log("✅ Discount calculation successful (from NET after commission)", {
    discountType: discount.discount_type,
    discountValue: discount.discount_value,
    ticketTotal,
    commissionAmount,
    netAfterCommission: parseFloat(netAfterCommission.toFixed(2)),
    discountAmount: parseFloat(discountAmount.toFixed(2)),
    finalTotal: parseFloat(finalTotal.toFixed(2))
  });

  return {
    discountAmount: parseFloat(discountAmount.toFixed(2)),
    finalTotal: parseFloat(finalTotal.toFixed(2)),
    discountData,
    netAfterCommission: parseFloat(netAfterCommission.toFixed(2))
  };
};

/**
 * Send Telegram notification for queue errors
 */
const notifyQueueError = (error, context, title) => {
  sendTelegramMessage(`
❌ <b>[${title}]</b>
<b>API AGENT BOOKING QUEUE ERROR</b>
<pre>${error.message}</pre>
🧾 Booking ID: <code>${context.booking_id || "N/A"}</code>
agent id: <code>${context.agent_id || "N/A"}</code>
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

  // console.log("Received agent booking data:", bookingData);
  try {
    // 1️⃣ Validate passenger counts
    validatePassengerCounts(
      bookingData.adult_passengers,
      bookingData.child_passengers,
      bookingData.infant_passengers || 0,
      bookingData.total_passengers
    );
    // console.log("Step 1: Validate passenger counts");

    // 2️⃣ Calculate ticket total
    const ticketCalculation = await calculateTicketTotal(
      bookingData.schedule_id,
      bookingData.subschedule_id || null,
      bookingData.departure_date,
      bookingData.adult_passengers,
      bookingData.child_passengers,
      bookingData.infant_passengers || 0
    );
    // console.log("Step 2: Calculate ticket total", ticketCalculation);

    if (!ticketCalculation.success) {
      return res.status(400).json({
        error: "Ticket calculation failed",
        message: ticketCalculation.error,
      });
    }

    // console.log("Step 3: Ticket calculation success");

    const calculatedTicketTotal = ticketCalculation.ticketTotal;

    // 3️⃣ Generate unique ticket_id
    const ticket_id = await generateOneWayTicketId();
    // console.log("Step 4: Generated ticket ID", ticket_id);

    // 4️⃣ Safety check for duplicates
    const existingBooking = await Booking.findOne({ where: { ticket_id } });
    if (existingBooking) {
      return res.status(400).json({
        error: "Ticket ID already exists",
        message: `The ticket ID '${ticket_id}' is already in use.`,
      });
    }
    // console.log("Step 5: Ticket ID is unique");

    // 5️⃣ Calculate transport total & gross total
    const transportTotal = Array.isArray(bookingData.transports)
      ? bookingData.transports.reduce(
          (total, t) =>
            total + (parseFloat(t.transport_price) || 0) * (t.quantity || 1),
          0
        )
      : 0;

    const ticketTotal = Number(calculatedTicketTotal) || 0;
    let ticketTotalAfterDiscount = ticketTotal;
    let grossTotal = ticketTotal + transportTotal;

    console.log("Step 6: Calculated transport and gross totals", {
      transportTotal,
      grossTotal,
    });

    // 6a️⃣ PRE-CALCULATE commission amount for discount calculation
    // Commission must be calculated FIRST before discount can be applied
    let preCalculatedCommission = 0;
    if (bookingData.agent_id) {
      try {
        const agent = await Agent.findByPk(bookingData.agent_id);
        if (agent) {
          // Get trip type
          let tripType = null;
          if (bookingData.subschedule_id) {
            const sub = await SubSchedule.findByPk(bookingData.subschedule_id);
            tripType = sub ? sub.trip_type : null;
          } else {
            const sch = await Schedule.findByPk(bookingData.schedule_id);
            tripType = sch ? sch.trip_type : null;
          }

          if (tripType) {
            // Use utility function to calculate commission
            preCalculatedCommission = calculateAgentCommissionAmount({
              agent,
              tripType,
              grossTotal,
              totalPassengers: bookingData.total_passengers,
              transportBookings: bookingData.transports || []
            });

            console.log("Step 6a: Pre-calculated commission for discount", {
              agent_id: bookingData.agent_id,
              tripType,
              preCalculatedCommission
            });
          }
        }
      } catch (commissionError) {
        console.error("⚠️ Error pre-calculating commission:", commissionError.message);
      }
    }

    // 6b️⃣ Apply discount if discount_code is provided
    // IMPORTANT: Discount is now calculated from NET (ticketTotal - commission)
    let discountAmount = 0;
    let discountData = null;
    let discount = req.discount || null;

    if (bookingData.discount_code) {
      try {
        if (!discount) {
          discount = await Discount.findOne({
            where: { code: bookingData.discount_code }
          });
        }

        if (discount) {
          // Pass commission amount to calculate discount from NET
          const discountResult = calculateDiscountAmount(
            discount,
            ticketTotal,
            preCalculatedCommission, // Commission deducted first before discount calculation
            bookingData.schedule_id,
            'departure' // one-way is considered departure
          );

          discountAmount = discountResult.discountAmount;
          discountData = discountResult.discountData;
          ticketTotalAfterDiscount = discountResult.finalTotal;
          grossTotal = ticketTotalAfterDiscount + transportTotal;

          console.log("Step 6b: Discount applied (calculated from NET after commission)", {
            code: bookingData.discount_code,
            ticketTotal,
            commissionAmount: preCalculatedCommission,
            netAfterCommission: discountResult.netAfterCommission,
            discountAmount,
            finalTicketTotal: ticketTotalAfterDiscount
          });
        } else {
          console.warn(`⚠️ Discount code '${bookingData.discount_code}' not found`);
        }
      } catch (discountError) {
        console.error("❌ Error applying discount:", discountError.message);
      }
    }

    // 6️⃣ Fetch exchange rate and calculate USD total
    let exchangeRate = null;
    let grossTotalInUsd = null;

    if (bookingData.currency === "IDR") {
      try {
        exchangeRate = await getExchangeRate("IDR");
        grossTotalInUsd = (grossTotal / exchangeRate).toFixed(2);
        console.log("Step 6a: Exchange rate fetched", {
          exchangeRate,
          grossTotalInUsd,
        });
      } catch (error) {
        console.warn("⚠️ Failed to fetch exchange rate:", error.message);
      }
    } else if (bookingData.currency === "USD") {
      exchangeRate = 1;
      grossTotalInUsd = grossTotal;
    }

    // 7️⃣ Create booking + transaction
    const result = await sequelize.transaction(async (t) => {
      const seatAvailabilityResult = await validateSeatAvailabilitySingleTrip(
        bookingData.schedule_id,
        bookingData.subschedule_id,
        bookingData.departure_date,
        bookingData.total_passengers
      );

      // console.log("Step 7: Seat availability result", seatAvailabilityResult);

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
          gross_total_in_usd: grossTotalInUsd,
          exchange_rate: exchangeRate,
          discount_data: discountData,
          payment_status: "invoiced",
          payment_method: "invoiced",
          booked_by: "api booking agent",
          booking_source: "agent",
          expiration_time: new Date(
            Date.now() + (process.env.EXPIRATION_TIME_MINUTES || 30) * 60000
          ),
        },
        { transaction: t }
      );
      // console.log("Step 8: Created booking record", booking.id);

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

      // 7️⃣ Add passengers
      if (bookingData.passengers && bookingData.passengers.length > 0) {
        await addPassengers(bookingData.passengers, booking.id, t);
      }

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

      // Return data (queue will be added AFTER transaction commits)
      return { booking, transactionEntry, commissionResult };
    });

    // 🔄 Queue for background processing (seat + transport + passengers + email)
    // Added AFTER transaction commits to avoid race condition
    try {
      await bookingAgentQueue.add({
        schedule_id: bookingData.schedule_id,
        subschedule_id: bookingData.subschedule_id,
        departure_date: bookingData.departure_date,
        total_passengers: bookingData.total_passengers,
        transports: bookingData.transports,
        passengers: bookingData.passengers,
        booking_id: result.booking.id,
        agent_id: bookingData.agent_id,
        agent_email: bookingData.agent_email,
        gross_total: grossTotal,
        payment_status: "invoiced",
        commission_amount: result.commissionResult?.commission || 0,
        transportTotal: transportTotal,
      });
      console.log("✅ Step 11: Added booking to processing queue after transaction commit");
    } catch (queueError) {
      console.error(`❌ CRITICAL: Failed to add booking to queue after commit!`, {
        booking_id: result.booking.id,
        ticket_id: ticket_id,
        error: queueError.message
      });

      // Send urgent notification to admin
      sendTelegramMessage(`
🚨 <b>CRITICAL: QUEUE ADD FAILED</b>
Booking created but NOT queued for processing!

🎫 Ticket: <code>${ticket_id}</code> (ID: ${result.booking.id})
Agent ID: <code>${bookingData.agent_id}</code>
⚠️ <b>ACTION REQUIRED:</b> Manually process this booking!

Error: <pre>${queueError.message}</pre>
🕒 ${new Date().toLocaleString('id-ID')}
      `).catch(err => console.error("Failed to send telegram alert:", err));
    }

    // 📱 Send Telegram notification for successful booking
    sendTelegramMessage(`
✅ <b>AGENT BOOKING SUCCESS</b>
🎫 Ticket: <code>${ticket_id}</code>
agent id: <code>${bookingData.agent_id}</code>
👤 Contact: <code>${bookingData.contact_name || '-'}</code>
👥 Passengers: <code>${bookingData.total_passengers}</code>
💰 Total: <code>IDR ${grossTotal.toLocaleString('id-ID')}</code>
📅 Date: <code>${bookingData.departure_date}</code>
🕒 ${new Date().toLocaleString('id-ID')}
    `).catch(err => console.error("⚠️ Telegram notification failed:", err.message));

    // Calculate net_total (what company receives after commission)
    const commissionAmount = result.commissionResult?.commission || 0;
    const netTotal = grossTotal - commissionAmount;

    return res.status(201).json({
      success: true,
      message: "Agent booking created successfully",
      data: {
        booking_id: result.booking.id,
        ticket_id,
        transaction_id: result.transactionEntry.transaction_id,
        ticket_total: calculatedTicketTotal,
        transport_total: transportTotal,
        discount_amount: discountAmount,
        discount_data: discountData,
        gross_total: grossTotal,
        net_total: netTotal, // Company receives (gross_total - commission)
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
    // passengers, // Already added in controller, not needed in queue
    booking_id,
    agent_email,
    commission_amount,
    transportTotal
  } = job.data;

  // console.log("🔄 Processing Agent Booking Queue:", job.data);

  const transaction = await sequelize.transaction();
  try {
    // 1️⃣ Handle seat availability
    let remainingSeatAvailabilities;

    if (subschedule_id) {
      // console.log(`🧩 Handling sub-schedule booking (${subschedule_id})`);
      remainingSeatAvailabilities = await handleSubScheduleBooking(
        schedule_id,
        subschedule_id,
        departure_date,
        total_passengers,
        transaction
      );
    } else {
      // console.log(`🚤 Handling main schedule booking (${schedule_id})`);
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

    // 3️⃣ Passengers already added in controller before queue, skip here to avoid duplicates

    await transaction.commit();
    // console.log(`🎉 Queue completed for agent booking ${booking_id}`);

    // 4️⃣ Send email (after transaction commit, non-blocking)
    try {
      const bookingWithDetails = await Booking.findByPk(booking_id, {
        include: [
          { model: Agent, as: "Agent" },
          { model: Passenger, as: "passengers" },
          {
            model: TransportBooking,
            as: "transportBookings",
            include: [{ model: Transport, as: "transport" }]
          },
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
        // console.log("✅ Staff email notification sent successfully");

        // Send success email to agent
        const routeInfo = bookingWithDetails.subSchedule
          ? `${bookingWithDetails.subSchedule.DestinationFrom?.name || bookingWithDetails.subSchedule.TransitFrom?.Destination?.name || 'Origin'} → ${bookingWithDetails.subSchedule.DestinationTo?.name || bookingWithDetails.subSchedule.TransitTo?.Destination?.name || 'Destination'}`
          : `${bookingWithDetails.schedule?.FromDestination?.name || 'Origin'} → ${bookingWithDetails.schedule?.ToDestination?.name || 'Destination'}`;

        await sendAgentBookingSuccessEmail({
          agentEmail: bookingWithDetails.Agent?.email || agent_email,
          agentName: bookingWithDetails.Agent?.name || "Agent",
          ticketId: bookingWithDetails.ticket_id,
          contactName: bookingWithDetails.contact_name,
          bookingDate: bookingWithDetails.booking_date,
          routeInfo,
          invoiceDownloadUrl: `${process.env.FRONTEND_URL}/invoice/${bookingWithDetails.ticket_id}`,
          ticketDownloadUrl: `${process.env.FRONTEND_URL}/ticket/${bookingWithDetails.ticket_id}`,
        });
        // console.log("✅ Agent email notification sent successfully");
      }
    } catch (emailError) {
      console.error("⚠️ Email sending failed:", emailError.message);
      // Don't fail the queue if email fails
    }

    try {
      const seatResult = await autoAssignSeatsForBooking({
        bookingId: booking_id,
        scheduleId: schedule_id,
        subscheduleId: subschedule_id,
        travelDate: departure_date,
      });
      if (seatResult?.updatedPassengers) {
        console.log("🪑 Auto-assign seat (one-way) updated passengers", {
          bookingId: booking_id,
          ...seatResult,
        });
      }
    } catch (assignError) {
      console.error(
        `⚠️ Auto-assign seat failed for booking ${booking_id}:`,
        assignError.message
      );
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

      // console.log(`🎫 Generated ticket pair: ${ticketPair.ticket_id_departure} & ${ticketPair.ticket_id_return}`);

      // Helper to process each leg (departure / return)
      const handleLeg = async (data, type, ticket_id, legDiscount) => {
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
        let ticketTotalAfterDiscount = ticket_total;
        let gross_total = ticket_total + transportTotal;

        // 5a️⃣ PRE-CALCULATE commission amount for discount calculation
        // Commission must be calculated FIRST before discount can be applied
        let preCalculatedCommission = 0;
        if (data.agent_id) {
          try {
            const agent = await Agent.findByPk(data.agent_id, { transaction: t });
            if (agent) {
              // Get trip type
              let tripType = null;
              if (data.subschedule_id) {
                const sub = await SubSchedule.findByPk(data.subschedule_id);
                tripType = sub ? sub.trip_type : null;
              } else {
                const sch = await Schedule.findByPk(data.schedule_id);
                tripType = sch ? sch.trip_type : null;
              }

              if (tripType) {
                // Use utility function to calculate commission
                preCalculatedCommission = calculateAgentCommissionAmount({
                  agent,
                  tripType,
                  grossTotal: gross_total,
                  totalPassengers: data.total_passengers,
                  transportBookings: data.transports || []
                });

                console.log(`✅ [${type}] Pre-calculated commission for discount`, {
                  agent_id: data.agent_id,
                  tripType,
                  preCalculatedCommission
                });
              }
            }
          } catch (commissionError) {
            console.error(`⚠️ [${type}] Error pre-calculating commission:`, commissionError.message);
          }
        }

        // 5b️⃣ Apply discount if discount_code is provided
        // IMPORTANT: Discount is now calculated from NET (ticket_total - commission)
        let discountAmount = 0;
        let discountData = null;
        let discount = legDiscount || null;

        if (data.discount_code) {
          try {
            if (!discount) {
              discount = await Discount.findOne({
                where: { code: data.discount_code }
              });
            }

            if (discount) {
              // Pass commission amount to calculate discount from NET
              const discountResult = calculateDiscountAmount(
                discount,
                ticket_total,
                preCalculatedCommission, // Commission deducted first before discount calculation
                data.schedule_id,
                type // 'departure' or 'return'
              );

              discountAmount = discountResult.discountAmount;
              discountData = discountResult.discountData;
              ticketTotalAfterDiscount = discountResult.finalTotal;
              gross_total = ticketTotalAfterDiscount + transportTotal;

              console.log(`✅ [${type}] Discount applied (calculated from NET after commission)`, {
                code: data.discount_code,
                ticket_total,
                commissionAmount: preCalculatedCommission,
                netAfterCommission: discountResult.netAfterCommission,
                discountAmount,
                finalTicketTotal: ticketTotalAfterDiscount
              });
            } else {
              console.warn(`⚠️ [${type}] Discount code '${data.discount_code}' not found`);
            }
          } catch (discountError) {
            console.error(`❌ [${type}] Error applying discount:`, discountError.message);
          }
        }

        // 5a️⃣ Fetch exchange rate and calculate USD total
        let exchangeRate = null;
        let grossTotalInUsd = null;

        if (data.currency === "IDR") {
          try {
            exchangeRate = await getExchangeRate("IDR");
            grossTotalInUsd = (gross_total / exchangeRate).toFixed(2);
          } catch (error) {
            console.warn(`⚠️ [${type}] Failed to fetch exchange rate:`, error.message);
          }
        } else if (data.currency === "USD") {
          exchangeRate = 1;
          grossTotalInUsd = gross_total;
        }

        // 6️⃣ Create booking
        const booking = await Booking.create(
          {
            ...data,
            ticket_id,
            ticket_total,
            gross_total,
            gross_total_in_usd: grossTotalInUsd,
            exchange_rate: exchangeRate,
            discount_data: discountData,
            payment_status: "invoiced",
            payment_method: "invoiced",
            booking_source: "agent",
             booked_by: "api booking agent",
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

        // 8️⃣ Add passengers with correct seat number for this leg
        const passengersForThisLeg = data.passengers.map(p => ({
          ...p,
          seat_number: type === 'departure' ? p.seat_number_departure : p.seat_number_return
        }));
        // console.log(`🧍‍♂️ [${type}] Adding ${passengersForThisLeg} passengers for booking ${booking.id}`);
        await addPassengers(passengersForThisLeg, booking.id, t);

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

        // 🔟 Return queue data (will be added AFTER transaction commits)
        return {
          booking,
          transaction: transactionEntry,
          ticketCalculation,
          commission: commissionResult,
          discountAmount,
          discountData,
          queueData: {
            schedule_id: data.schedule_id,
            subschedule_id: data.subschedule_id,
            booking_date: data.booking_date,
            total_passengers: data.total_passengers,
            transports: data.transports,
            passengers: data.passengers, // Pass original passengers with both seat numbers
            booking_id: booking.id,
            agent_id: data.agent_id,
            agent_email: data.agent_email,
            ticket_total,
            gross_total,
            ticket_id,
            payment_status: "invoiced",
            type,
            commission_amount: commissionResult?.commission || 0,
          }
        };
      };

      // 🚤 Process both legs with their respective ticket IDs
      const departureResult = await handleLeg(
        departure,
        "departure",
        ticketPair.ticket_id_departure,
        req.departureDiscount
      );
      const returnResult = await handleLeg(
        returnData,
        "return",
        ticketPair.ticket_id_return,
        req.returnDiscount
      );

      return { departure: departureResult, return: returnResult };
    });

    // 🔄 Add to queue AFTER transaction commits (fixes race condition)
    // Using Promise.all for parallel execution (faster for round trip)
    try {
      await Promise.all([
        bookingAgentRoundQueue.add(result.departure.queueData),
        bookingAgentRoundQueue.add(result.return.queueData)
      ]);
      console.log(`✅ Added both legs to queue in parallel after transaction commit`);
    } catch (queueError) {
      console.error(`❌ CRITICAL: Failed to add booking to queue after commit!`, {
        departure_booking_id: result.departure.booking.id,
        return_booking_id: result.return.booking.id,
        error: queueError.message
      });

      // Send urgent notification to admin
      sendTelegramMessage(`
🚨 <b>CRITICAL: QUEUE ADD FAILED</b>
Booking created but NOT queued for processing!

🎫 Departure: <code>${result.departure.booking.ticket_id}</code> (ID: ${result.departure.booking.id})
🎫 Return: <code>${result.return.booking.ticket_id}</code> (ID: ${result.return.booking.id})
⚠️ <b>ACTION REQUIRED:</b> Manually process these bookings!

Error: <pre>${queueError.message}</pre>
🕒 ${new Date().toLocaleString('id-ID')}
      `).catch(err => console.error("Failed to send telegram alert:", err));
    }

    const totalGross =
      result.departure.booking.gross_total +
      result.return.booking.gross_total;

    // 📱 Send Telegram notification for successful round-trip booking
    sendTelegramMessage(`
✅ <b>AGENT ROUND-TRIP BOOKING SUCCESS</b>
🎫 Departure: <code>${result.departure.booking.ticket_id}</code>
🎫 Return: <code>${result.return.booking.ticket_id}</code>
Agent id : <code>${departure.agent_id}</code>
👤 Contact: <code>${departure.contact_name || '-'}</code>
👥 Passengers: <code>${departure.total_passengers}</code>
💰 Total: <code>IDR ${totalGross.toLocaleString('id-ID')}</code>
📅 Dep: <code>${departure.booking_date}</code> | Ret: <code>${returnData.booking_date}</code>
🕒 ${new Date().toLocaleString('id-ID')}
    `).catch(err => console.error("⚠️ Telegram notification failed:", err.message));

    // Calculate net_total for each leg and total (what company receives after commission)
    const departureCommission = result.departure.commission?.commission || 0;
    const returnCommission = result.return.commission?.commission || 0;
    const departureNetTotal = result.departure.booking.gross_total - departureCommission;
    const returnNetTotal = result.return.booking.gross_total - returnCommission;
    const totalCommission = departureCommission + returnCommission;
    const totalNetTotal = totalGross - totalCommission;

    return res.status(201).json({
      success: true,
      message: "Agent round-trip booking created successfully",
      data: {
        departure: {
          booking_id: result.departure.booking.id,
          ticket_id: result.departure.booking.ticket_id,
          transaction_id: result.departure.transaction.transaction_id,
          ticket_total: result.departure.booking.ticket_total,
          discount_amount: result.departure.discountAmount,
          discount_data: result.departure.discountData,
          gross_total: result.departure.booking.gross_total,
          net_total: departureNetTotal, // Company receives (gross - commission)
          pricing_breakdown: result.departure.ticketCalculation.breakdown,
          commission: result.departure.commission,
        },
        return: {
          booking_id: result.return.booking.id,
          ticket_id: result.return.booking.ticket_id,
          transaction_id: result.return.transaction.transaction_id,
          ticket_total: result.return.booking.ticket_total,
          discount_amount: result.return.discountAmount,
          discount_data: result.return.discountData,
          gross_total: result.return.booking.gross_total,
          net_total: returnNetTotal, // Company receives (gross - commission)
          pricing_breakdown: result.return.ticketCalculation.breakdown,
          commission: result.return.commission,
        },
        total_gross: totalGross,
        total_commission: totalCommission,
        total_discount: (result.departure.discountAmount || 0) + (result.return.discountAmount || 0),
        total_net: totalNetTotal, // Total company receives
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
    passengers, // Keep for passing to email
    booking_id,
    agent_email,
    ticket_id,
    type,
    commission_amount,
  } = job.data;

  // console.log(`\n[Queue] 🌀 Processing ${type.toUpperCase()} booking ID ${booking_id}`);

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
      // console.log(`🚐 Transport bookings added for booking ${booking_id}`);
    }

    // 4️⃣ Passengers already added in controller before queue, skip here to avoid duplicates

    await transaction.commit();
    // console.log(`🎉 Agent round-trip queue success for booking ${booking_id}`);

    // 5️⃣ Track completion and send email when BOTH legs are done
    // Extract base number from ticket (GG-RT-429813 -> 429812 for pairing)
    // Departure tickets are odd numbers, return tickets are even (odd + 1)
    // So we use (ticketNumber - 1) to get the base, which is always even
    const ticketMatch = ticket_id.match(/GG-RT-(\d+)/);
    if (!ticketMatch) {
      console.error(`⚠️ Invalid ticket format: ${ticket_id}`);
      done();
      return;
    }

    const ticketNumber = parseInt(ticketMatch[1]);
    const baseNumber = ticketNumber % 2 === 0 ? ticketNumber - 1 : ticketNumber; // Convert to odd (departure) number
    const baseTicketId = `GG-RT-${baseNumber}`;

    if (!roundTripCompletionMap.has(baseTicketId)) {
      roundTripCompletionMap.set(baseTicketId, {
        [type]: booking_id,
        [`${type}_commission`]: commission_amount,
        [`${type}_ticket`]: ticket_id,
        passengers, // Store original passengers array for email
        agent_email
      });
      // console.log(`📝 Tracking ${type} for base ticket ${baseTicketId} (actual: ${ticket_id})`);
    } else {
      const existingData = roundTripCompletionMap.get(baseTicketId);
      existingData[type] = booking_id;
      existingData[`${type}_commission`] = commission_amount;
      existingData[`${type}_ticket`] = ticket_id;
      existingData.passengers = passengers; // Update passengers
      existingData.agent_email = agent_email;

      // Check if both departure and return are completed
      if (existingData.departure && existingData.return) {
        // console.log(`✅ Both legs completed for ${baseTicketId}`);
        // console.log(`   Departure: ${existingData.departure_ticket} (ID: ${existingData.departure})`);
        // console.log(`   Return: ${existingData.return_ticket} (ID: ${existingData.return})`);
        // console.log(`   📧 Sending round-trip email...`);

        try {
          const departureBooking = await Booking.findByPk(existingData.departure, {
            include: [
              { model: Agent, as: "Agent" },
              { model: Passenger, as: "passengers" },
              {
                model: TransportBooking,
                as: "transportBookings",
                include: [{ model: Transport, as: "transport" }]
              },
            ],
          });

          const returnBooking = await Booking.findByPk(existingData.return, {
            include: [
              { model: Agent, as: "Agent" },
              { model: Passenger, as: "passengers" },
              {
                model: TransportBooking,
                as: "transportBookings",
                include: [{ model: Transport, as: "transport" }]
              },
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
// send email notifications for round trip to staff
          if (departureBooking && returnBooking) {
            try {
              const departureSeatResult = await autoAssignSeatsForBooking({
                bookingId: departureBooking.id,
                scheduleId: departureBooking.schedule_id,
                subscheduleId: departureBooking.subschedule_id,
                travelDate: departureBooking.booking_date,
              });
              if (departureSeatResult?.updatedPassengers) {
                console.log("🪑 Auto-assign seat completed for departure booking", {
                  bookingId: departureBooking.id,
                  ...departureSeatResult,
                });
              }

              const returnSeatResult = await autoAssignSeatsForBooking({
                bookingId: returnBooking.id,
                scheduleId: returnBooking.schedule_id,
                subscheduleId: returnBooking.subschedule_id,
                travelDate: returnBooking.booking_date,
              });
              if (returnSeatResult?.updatedPassengers) {
                console.log("🪑 Auto-assign seat completed for return booking", {
                  bookingId: returnBooking.id,
                  ...returnSeatResult,
                });
              }
            } catch (assignError) {
              console.error(
                "⚠️ Auto-assign seat failed for round-trip booking:",
                assignError.message
              );
            }

            await sendEmailApiRoundTripAgentStaff(
              process.env.EMAIL_AGENT,
              departureBooking,
              returnBooking,
              departureBooking.Agent?.name || "Unknown Agent",
              departureBooking.Agent?.email || existingData.agent_email,
              existingData.passengers // Pass original passengers array with both seat numbers
            );
            // console.log("✅ Staff round-trip email notification sent successfully");

            // Send success email to agent for departure
            const departureRouteInfo = departureBooking.subSchedule
              ? `${departureBooking.subSchedule.DestinationFrom?.name || departureBooking.subSchedule.TransitFrom?.Destination?.name || 'Origin'} → ${departureBooking.subSchedule.DestinationTo?.name || departureBooking.subSchedule.TransitTo?.Destination?.name || 'Destination'}`
              : `${departureBooking.schedule?.FromDestination?.name || 'Origin'} → ${departureBooking.schedule?.ToDestination?.name || 'Destination'}`;

            await sendAgentBookingSuccessEmail({
              agentEmail: departureBooking.Agent?.email || existingData.agent_email,
              agentName: departureBooking.Agent?.name || "Agent",
              ticketId: departureBooking.ticket_id,
              contactName: departureBooking.contact_name,
              bookingDate: departureBooking.booking_date,
              routeInfo: `${departureRouteInfo} (Departure)`,
              invoiceDownloadUrl: `${process.env.FRONTEND_URL}/invoice/${departureBooking.ticket_id}`,
              ticketDownloadUrl: `${process.env.FRONTEND_URL}/ticket/${departureBooking.ticket_id}`,
            });

            // Send success email to agent for return
            const returnRouteInfo = returnBooking.subSchedule
              ? `${returnBooking.subSchedule.DestinationFrom?.name || returnBooking.subSchedule.TransitFrom?.Destination?.name || 'Origin'} → ${returnBooking.subSchedule.DestinationTo?.name || returnBooking.subSchedule.TransitTo?.Destination?.name || 'Destination'}`
              : `${returnBooking.schedule?.FromDestination?.name || 'Origin'} → ${returnBooking.schedule?.ToDestination?.name || 'Destination'}`;

            await sendAgentBookingSuccessEmail({
              agentEmail: returnBooking.Agent?.email || existingData.agent_email,
              agentName: returnBooking.Agent?.name || "Agent",
              ticketId: returnBooking.ticket_id,
              contactName: returnBooking.contact_name,
              bookingDate: returnBooking.booking_date,
              routeInfo: `${returnRouteInfo} (Return)`,
              invoiceDownloadUrl: `${process.env.FRONTEND_URL}/invoice/${returnBooking.ticket_id}`,
              ticketDownloadUrl: `${process.env.FRONTEND_URL}/ticket/${returnBooking.ticket_id}`,
            });
            // console.log("✅ Agent round-trip email notifications sent successfully");
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
