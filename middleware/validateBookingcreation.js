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
} = require("../models");
const { Op } = require("sequelize");

const validateBookingCreation = async (req, res, next) => {
  console.log("\n=== Starting Booking Creation Validation ===");

  const {
    schedule_id,
    passengers,
    ticket_id,
    total_passengers,
    booking_date,
    adult_passengers,
    child_passengers,
  } = req.body;

  try {
    console.log("📝 Checking required fields...");
    const requiredFields = [
      "schedule_id",
      "total_passengers",
      "booking_date",
      "ticket_id",
      "adult_passengers",
    ];

    const missingFields = requiredFields.filter((field) => !req.body[field]);
    if (missingFields.length > 0) {
      console.log("❌ Missing required fields:", missingFields);
      return res.status(400).json({
        error: "Missing required fields",
        missingFields,
      });
    }

    console.log("👥 Validating passenger counts...");
    const calculatedTotal = adult_passengers + child_passengers;
    if (calculatedTotal !== total_passengers) {
      return res.status(400).json({
        error: "Invalid passenger count",
        message:
          "Sum of adult and child passengers must equal total passengers (infants are not counted)",
        provided: {
          total_passengers,
          calculated: calculatedTotal,
          adult_passengers,
          child_passengers,
        },
      });
    }

    console.log("🧳 Validating passengers data...");
    if (!Array.isArray(passengers)) {
      return res.status(400).json({
        error: "Invalid passengers data",
        message: "Passengers should be provided as an array",
      });
    }

    for (let i = 0; i < passengers.length; i++) {
      const passenger = passengers[i];

      // Validate required passenger fields
      if (!passenger.name || !passenger.passenger_type || !passenger.nationality || !passenger.passport_id) {
        return res.status(400).json({
          error: "Invalid passenger data",
          message: `Passenger at index ${i} is missing required fields (name, passenger_type, nationality, or passport_id)`,
          passenger,
        });
      }

      // Validate seat number if provided
      if (passenger.seat_number) {
        console.log(`🔍 Validating seat number for passenger at index ${i}: ${passenger.seat_number}`);

        const occupiedSeat = await Booking.findOne({
          where: { schedule_id },
          include: [
            {
              model: Passenger,
              as: "passengers",
              where: { seat_number: passenger.seat_number },
            },
          ],
        });

        if (occupiedSeat) {
          return res.status(400).json({
            error: "Seat number unavailable",
            message: `Seat number ${passenger.seat_number} is already occupied.`,
            passenger,
          });
        }

        console.log(`✅ Seat number ${passenger.seat_number} is available.`);
      }
    }

    // If all validations pass
    console.log("✅ All validations passed");
    next();
  } catch (error) {
    console.error("❌ Error in booking validation:", error);
    return res.status(500).json({
      error: "Validation error",
      details: error.message,
    });
  }
};

const validateRoundTripBookingPost = async (req, res, next) => {
  console.log("\n=== Starting Round Trip Booking Post Validation ===");

  try {
    const { departure, return: returnBooking } = req.body;
    console.log("📝 Validating round trip booking...");

    // First, check if the main objects exist
    if (!departure || !returnBooking) {
      return res.status(400).json({
        status: "error",
        message: "Both departure and return booking details are required"
      });
    }

    // Check if departure and return are objects
    if (typeof departure !== "object" || typeof returnBooking !== "object") {
      return res.status(400).json({
        status: "error",
        message: "Departure and return must be objects containing booking details"
      });
    }

    // Function to validate schedule ID
    const validateSchedule = async (scheduleId, type) => {
      const schedule = await Schedule.findOne({ where: { id: scheduleId } });
      if (!schedule) {
        throw {
          status: "error",
          message: `Invalid schedule_id in ${type} booking. Schedule ID '${scheduleId}' does not exist.`
        };
      }
    };

    // Function to validate passenger seat availability
    const validatePassengerSeats = async (passengers, scheduleId, type) => {
      console.log(`🔍 Validating seat availability for ${type} passengers...`);
    
      for (const passenger of passengers) {
        if (!passenger.seat_number) {
          console.log(`ℹ️ No seat_number specified for passenger ${passenger.name}, skipping validation.`);
          continue; // Skip validation for passengers without a seat_number
        }
    
        // Check if the seat is already occupied
        const occupiedSeat = await Booking.findOne({
          where: { schedule_id: scheduleId },
          include: [
            {
              model: Passenger,
              as: "passengers",
              where: { seat_number: passenger.seat_number }, // Apply the condition here
            },
          ],
        });
    
        if (occupiedSeat) {
          throw {
            status: "error",
            message: `Seat number ${passenger.seat_number} is already occupied in ${type} booking.`,
          };
        }
    
        console.log(`✅ Seat number ${passenger.seat_number} is available.`);
      }
    };
    // Validate Booking Object (Shared for Departure and Return)
    const validateBooking = async (booking, type) => {
      console.log(`📝 Validating ${type} booking...`);

      // Required fields for booking
      const requiredFields = [
        "schedule_id",
        "subschedule_id",
        "total_passengers",
        "booking_date",
        "agent_id",
        "gross_total",
        "ticket_total",
        "payment_status",
        "contact_name",
        "contact_phone",
        "contact_email",
        "adult_passengers",
        "child_passengers",
        "infant_passengers",
        "payment_method",
        "booking_source",
        "ticket_id",
        "bank_fee",
        "currency",
        "gross_total_in_usd",
        "exchange_rate"
      ];

      // Check for missing fields
      const missingFields = requiredFields.filter((field) => {
        const value = booking[field];
        return value === undefined || value === null || value === "";
      });

      if (missingFields.length > 0) {
        throw {
          status: "error",
          message: `Missing required fields in ${type} booking: ${missingFields.join(", ")}`
        };
      }

      // Validate schedule ID exists
      await validateSchedule(booking.schedule_id, type);

      // Validate passenger seat numbers
      if (booking.passengers && Array.isArray(booking.passengers)) {
        await validatePassengerSeats(booking.passengers, booking.schedule_id, type);
      }
    };

    // Validate both bookings
    await validateBooking(departure, "departure");
    await validateBooking(returnBooking, "return");

    console.log("✅ All validations passed");
    next();
  } catch (error) {
    console.error("❌ Validation error:", error);
    return res.status(400).json({
      status: "error",
      message: error.message || "Validation failed",
      details: error
    });
  }
};

const validateMultipleBookingCreation = async (req, res, next) => {
  console.log("\n=== Starting Multiple Booking Validation ===");

  const {
    total_passengers,
    passengers,
    agent_id,
    gross_total,
    ticket_total,
    payment_status,
    transports,
    contact_name,
    contact_phone,
    contact_passport_id,
    contact_nationality,
    contact_email,
    payment_method,
    booking_source,
    adult_passengers,
    child_passengers,
    infant_passengers,
    // transaction_type,
    currency,
  } = req.body;

  try {
    // Required fields validation
    console.log("📝 Checking required fields...");
    const requiredFields = [
      "total_passengers",
      "ticket_total",
      "payment_status",
      "contact_name",
      "contact_phone",
      "contact_email",
      "adult_passengers",
      // 'child_passengers'
    ];

    const missingFields = requiredFields.filter((field) => !req.body[field]);
    if (missingFields.length > 0) {
      console.log("❌ Missing required fields:", missingFields);
      return res.status(400).json({
        error: "Missing required fields",
        missingFields,
      });
    }

    // Validate passenger counts (excluding infants)
    console.log("👥 Validating passenger counts...");
    const calculatedTotal = adult_passengers + child_passengers;
    if (calculatedTotal !== total_passengers) {
      return res.status(400).json({
        error: "Invalid passenger count",
        message:
          "Sum of adult and child passengers must equal total passengers (infants are not counted)",
        provided: {
          total_passengers,
          calculated: calculatedTotal,
          adult_passengers,
          child_passengers,
          infant_passengers: infant_passengers || 0,
        },
      });
    }

    // Validate payment status
    console.log("💰 Validating payment status...");
    const validPaymentStatuses = ["pending", "paid", "invoiced"];
    if (!validPaymentStatuses.includes(payment_status)) {
      return res.status(400).json({
        error: "Invalid payment status",
        validStatuses: validPaymentStatuses,
      });
    }

    // Validate payment method if provided
    if (payment_method) {
      console.log("💳 Validating payment method...");
      const validPaymentMethods = [
        "credit_card",
        "bank_transfer",
        "cash",
        "paypal",
        "midtrans",
        "Midtrans",
        "invoiced",
        "invoice",
        "cash_bali",
        "cash_gili_trawangan",
        "cash_gili_gede",
      ];
      if (!validPaymentMethods.includes(payment_method)) {
        return res.status(400).json({
          error: "Invalid payment method",
          validMethods: validPaymentMethods,
        });
      }
    }

    // Validate transport details if provided
    if (transports && transports.length > 0) {
      console.log("🚗 Validating transport details...");
      for (const transport of transports) {
        if (!transport.transport_price || !transport.quantity) {
          return res.status(400).json({
            error: "Invalid transport details",
            message: "Each transport must have price and quantity",
          });
        }
        if (
          isNaN(transport.transport_price) ||
          transport.transport_price <= 0
        ) {
          return res.status(400).json({
            error: "Invalid transport price",
            message: "Transport price must be a positive number",
          });
        }
        if (!Number.isInteger(transport.quantity) || transport.quantity < 1) {
          return res.status(400).json({
            error: "Invalid transport quantity",
            message: "Transport quantity must be a positive integer",
          });
        }
      }
    }

    // Validate passenger data structure and required fields
    console.log("🧳 Validating passengers data...");

    if (!Array.isArray(passengers)) {
      return res.status(400).json({
        error: "Invalid passengers data",
        message: "Passengers should be provided as an array",
      });
    }

    const validPassengerTypes = ["adult", "child", "infant"];

    for (let i = 0; i < passengers.length; i++) {
      const p = passengers[i];

      // Cek field wajib: name, passenger_type, nationality, dan passport_id
      if (!p.name || !p.passenger_type || !p.nationality || !p.passport_id) {
        return res.status(400).json({
          error: "Invalid passenger data",
          message: `Passenger at index ${i} is missing required fields (name, passenger_type, nationality, or passport_id)`,
          passenger: p,
        });
      }

      // Validasi passenger_type harus salah satu dari 'adult', 'child', atau 'infant'
      if (!validPassengerTypes.includes(p.passenger_type)) {
        return res.status(400).json({
          error: "Invalid passenger type",
          message: `Passenger at index ${i} has invalid passenger_type '${
            p.passenger_type
          }'. Valid values are ${validPassengerTypes.join(", ")}`,
          passenger: p,
        });
      }

      // Jika diperlukan, tambahkan validasi lainnya, misalnya format passport_id atau nationality.
    }

    // Jika semua penumpang valid, lanjut ke middleware berikutnya

    // Validate email format
    console.log("📧 Validating email format...");
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(contact_email)) {
      return res.status(400).json({
        error: "Invalid email format",
      });
    }

    // Validate phone number format
    console.log("📱 Validating phone number...");
    const phoneRegex = /^[+]?[\d\s-]{8,}$/;
    if (!phoneRegex.test(contact_phone)) {
      return res.status(400).json({
        error: "Invalid phone number format",
        message:
          "Phone number should contain at least 8 digits and may include +, spaces, or hyphens",
      });
    }

    // Validate currency if provided
    if (currency) {
      console.log("💱 Validating currency...");
      const validCurrencies = ["IDR", "USD"];
      if (!validCurrencies.includes(currency)) {
        return res.status(400).json({
          error: "Invalid currency",
          validCurrencies,
        });
      }
    }

    // Validate transaction type if provided
    // if (transaction_type) {
    //   console.log("🔄 Validating transaction type...");
    //   const validTransactionTypes = ["booking", "payment", "refund"];
    //   if (!validTransactionTypes.includes(transaction_type)) {
    //     return res.status(400).json({
    //       error: "Invalid transaction type",
    //       validTypes: validTransactionTypes,
    //     });
    //   }
    // }

    // Validate numeric values
    console.log("🔢 Validating numeric values...");
    if (
      ticket_total &&
      (isNaN(ticket_total) || parseFloat(ticket_total) <= 0)
    ) {
      return res.status(400).json({
        error: "Invalid ticket total",
        message: "Ticket total must be a positive number",
      });
    }

    if (gross_total && (isNaN(gross_total) || parseFloat(gross_total) <= 0)) {
      return res.status(400).json({
        error: "Invalid gross total",
        message: "Gross total must be a positive number",
      });
    }

    // Validate agent if provided
    if (agent_id) {
      console.log("👤 Validating agent...");
      const agent = await Agent.findByPk(agent_id);
      if (!agent) {
        return res.status(400).json({
          error: "Invalid agent_id",
          message: "Agent not found",
        });
      }
    }

    console.log("✅ All validations passed");
    next();
  } catch (error) {
    console.error("❌ Error in multiple booking validation:", error);
    return res.status(500).json({
      error: "Validation error",
      details: error.message,
    });
  }
};

module.exports = {
  validateBookingCreation,
  validateMultipleBookingCreation,
  validateRoundTripBookingPost
};
