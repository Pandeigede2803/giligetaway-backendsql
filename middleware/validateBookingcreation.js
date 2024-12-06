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
    subschedule_id,
    total_passengers,
    booking_date,
    passengers,
    agent_id,
    gross_total,
    ticket_total,
    payment_status,
    transports,
    contact_name,
    contact_phone,
    contact_email,
    payment_method,
    adult_passengers,
    child_passengers,
    infant_passengers,
    ticket_id,
    currency,
  } = req.body;

  try {
    // Required fields validation
    console.log("📝 Checking required fields...");
    const requiredFields = [
      "schedule_id",
      "total_passengers",
      "booking_date",
      "ticket_total",
      "contact_name",
      "contact_phone",
      "contact_email",
      "payment_status",
      "passengers",
      "gross_total",
      "ticket_total",
      "ticket_id",
      "adult_passengers",
      // "child_passengers",
    ];

    const missingFields = requiredFields.filter((field) => !req.body[field]);
    if (missingFields.length > 0) {
      console.log("❌ Missing required fields:", missingFields);
      return res.status(400).json({
        error: "Missing required fields",
        missingFields,
      });
    }

    // Validate ticket_id format (gg-ow-XXXXXX)
    console.log("🎫 Validating ticket ID format...");
    const ticketRegex = /^GG-(OW|RT)-\d{6}$/;
    if (!ticketRegex.test(ticket_id)) {
      console.log("❌ Invalid ticket ID format:", ticket_id);
      return res.status(400).json({
        error: "Invalid ticket ID format",
        message:
          "Ticket ID should follow format: GG-OW-XXXXXX or GG-RT-XXXXXX (where X is a number)",
        example: "GG-OW-123456 or GG-RT-654321",
      });
    }
    const existingTicket = await Booking.findOne({ where: { ticket_id } });
    if (existingTicket) {
      console.log("❌ Duplicate ticket ID:", ticket_id);
      return res.status(400).json({
        error: "Ticket ID already exists",
        message: `The ticket ID '${ticket_id}' is already in use`,
      });
    }

    // Validate booking date
    console.log("📅 Validating booking date...");

    const bookingDateObj = new Date(booking_date);
    
    // Pastikan tanggal valid
    if (isNaN(bookingDateObj.getTime())) {
      return res.status(400).json({
        error: "Invalid booking date",
        message: "Date format should be a valid date string, e.g., 'Dec 6, 2024'",
        example: "Dec 6, 2024",
      });
    }
    
    // Reset waktu untuk validasi tanggal saja
    const currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0); // Set waktu hari ini ke 00:00:00
    bookingDateObj.setHours(0, 0, 0, 0); // Set waktu tanggal booking ke 00:00:00
    
    // Validasi tidak boleh di masa lalu
    if (bookingDateObj < currentDate) {
      return res.status(400).json({
        error: "Invalid booking date",
        message: "Booking date cannot be in the past",
      });
    }
    
    console.log("✅ Booking date is valid:", booking_date);
    

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

    // Other validations remain the same...
    // Validate payment status
    console.log("💰 Validating payment status...");
    const validPaymentStatuses = ["pending", "paid", "invoiced"];
    if (!validPaymentStatuses.includes(payment_status)) {
      return res.status(400).json({
        error: "Invalid payment status",
        validStatuses: validPaymentStatuses,
      });
    }

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

    // Validate payment method if provided
    if (payment_method) {
      console.log("💳 Validating payment method...");
      const validPaymentMethods = [
        "credit_card",
        "bank_transfer",
        "cash",
        "paypal",
      ];
      if (!validPaymentMethods.includes(payment_method)) {
        return res.status(400).json({
          error: "Invalid payment method",
          validMethods: validPaymentMethods,
        });
      }
    }

    // Validate email format
    console.log("📧 Validating email format...");
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(contact_email)) {
      return res.status(400).json({
        error: "Invalid email format",
      });
    }

    // Validate phone number format (made more flexible)
    console.log("📱 Validating phone number...");
    const phoneRegex = /^[+]?[\d\s-]{8,}$/;
    if (!phoneRegex.test(contact_phone)) {
      return res.status(400).json({
        error: "Invalid phone number format",
        message:
          "Phone number should contain at least 8 digits and may include +, spaces, or hyphens",
      });
    }

    // If currency provided, validate it
    if (currency && !["IDR", "USD"].includes(currency)) {
      return res.status(400).json({
        error: "Invalid currency",
        validCurrencies: ["IDR", "USD"],
      });
    }

    // Schedule and subschedule validation...
    if (schedule_id) {
      console.log("🔍 Validating schedule...");
      const schedule = await Schedule.findByPk(schedule_id);
      if (!schedule) {
        return res.status(400).json({
          error: "Schedule not found",
        });
      }
      if (!schedule.available) {
        return res.status(400).json({
          error: "Selected schedule is currently unavailable",
        });
      }
    }

    if (subschedule_id) {
      console.log("🔍 Validating subschedule...");
      const subschedule = await SubSchedule.findByPk(subschedule_id);
      if (!subschedule) {
        return res.status(400).json({
          error: "SubSchedule not found",
        });
      }
      if (!subschedule.available) {
        return res.status(400).json({
          error: "Selected subschedule is currently unavailable",
        });
      }
    }

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
};
