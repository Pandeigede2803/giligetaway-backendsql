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
const { Op } = require("sequelize");;


const { getSeasonPrice } = require('../util/formatSchedules'); // import di atas
const { validate } = require("node-cron");

const calculateTransportTotalAndValidate = async (transports, total_passengers) => {
  if (!Array.isArray(transports)) return 0;

  let total = 0;
  const tolerance = 1000; // Toleransi 1.000 IDR

  for (const t of transports) {
    if (!t.transport_id) throw new Error("Transport ID is missing");

    const transportRecord = await Transport.findByPk(t.transport_id);
    if (!transportRecord) throw new Error(`Transport ID ${t.transport_id} not found`);

    const cost = transportRecord.cost || 0;
    const quantity = t.quantity || total_passengers;
    const expectedTotal = cost * quantity;
    const providedPrice = t.transport_price || 0;

    const difference = Math.abs(providedPrice - expectedTotal);
    if (difference > tolerance) {
      throw {
        message: `Transport price mismatch for transport_id ${t.transport_id}`,
        details: {
          transport_id: t.transport_id,
          expected: expectedTotal,
          received: providedPrice,
          cost_per_unit: cost,
          quantity,
        },
      };
    }

    total += providedPrice;
  }

  return total;
};

const getTicketPrice = async (schedule_id, subschedule_id, booking_date) => {
  if (subschedule_id) {
    const subschedule = await SubSchedule.findByPk(subschedule_id);
    if (!subschedule) throw new Error("Invalid Subschedule ID");
    return getSeasonPrice(
      booking_date,
      subschedule.low_season_price,
      subschedule.high_season_price,
      subschedule.peak_season_price
    );
  } else {
    const schedule = await Schedule.findByPk(schedule_id);
    if (!schedule) throw new Error("Invalid Schedule ID");
    return getSeasonPrice(
      booking_date,
      schedule.low_season_price,
      schedule.high_season_price,
      schedule.peak_season_price
    );
  }
};



const validateSingleBookingGrossTotal = async (req, res, next) => {
  console.log("\n=== Validating Gross Total for Single Booking (with Season + Transport Price Check) ===");

  const {
    schedule_id,
    subschedule_id,
    total_passengers,
    transports = [],
    bank_fee = 0,
    discount = 0,
    gross_total: clientGrossTotal,
    booking_date,
  } = req.body;

  try {
    if (!schedule_id && !subschedule_id) {
      return res.status(400).json({ error: "Schedule ID or Subschedule ID is required" });
    }

    if (!total_passengers || total_passengers <= 0) {
      return res.status(400).json({ error: "Total passengers must be greater than zero" });
    }

    const ticketPrice = await getTicketPrice(schedule_id, subschedule_id, booking_date);
    const ticket_total = ticketPrice * total_passengers;

    const transport_total = await calculateTransportTotalAndValidate(transports, total_passengers);

    const expectedGrossTotal = ticket_total + transport_total - discount + bank_fee;
    const difference = Math.abs(expectedGrossTotal - clientGrossTotal);
    const tolerance = 1;

    if (difference > tolerance) {
      return res.status(400).json({
        error: "Gross total mismatch",
        message: `Expected gross total (${expectedGrossTotal}) does not match provided gross total (${clientGrossTotal})`,
        breakdown: {
          total_passengers,
          ticket_price: ticketPrice,
          ticket_total,
          transport_total,
          discount,
          bank_fee,
          expectedGrossTotal,
        },
      });
    }

    console.log(`✅ Gross total valid: ${expectedGrossTotal}`);
    next();
  } catch (error) {
    console.error("❌ Error validating gross total:", error);
    return res.status(400).json({
      error: "Validation failed",
      message: error.message || error,
      ...(error.details && { breakdown: error.details }),
    });
  }
};

const validateGrossTotalForSegment = async (segment, type) => {
  const {
    schedule_id,
    subschedule_id,
    total_passengers,
    transports = [],
    discount = 0,
    bank_fee = 0,
    gross_total,
    booking_date
  } = segment;

  if (!schedule_id && !subschedule_id) throw new Error(`[${type}] schedule_id or subschedule_id is required`);
  if (!total_passengers || total_passengers <= 0) throw new Error(`[${type}] Invalid total_passengers`);

  const ticketPrice = await getTicketPrice(schedule_id, subschedule_id, booking_date);
  const ticket_total = ticketPrice * total_passengers;

  const transport_total = await calculateTransportTotalAndValidate(transports, total_passengers, type);

  const expectedGross = ticket_total + transport_total - discount + bank_fee;

  const difference = Math.abs(expectedGross - gross_total);
  const tolerance = 1;

  if (difference > tolerance) {
    throw {
      message: `[${type}] Gross total mismatch`,
      breakdown: {
        total_passengers,
        booking_date,
        ticket_price: ticketPrice,
        ticket_total,
        transport_total,
        discount,
        bank_fee,
        expected: expectedGross,
        received: gross_total
      }
    };
  }

  return true;
};

const validateRoundTripGrossTotal = async (req, res, next) => {
  console.log("\n=== Validating Round Trip Gross Total (with Season Pricing) ===");

  try {
    const { departure, return: returnBooking } = req.body;

    if (!departure || !returnBooking) {
      return res.status(400).json({ error: "Both departure and return data must be provided" });
    }

    await validateGrossTotalForSegment(departure, "departure");
    await validateGrossTotalForSegment(returnBooking, "return");

    console.log("✅ Gross total validated for both departure and return");
    next();
  } catch (err) {
    console.error("❌ Gross total validation error:", err);
    return res.status(400).json({
      error: "Gross total validation failed",
      details: err.message || err,
      ...(err.breakdown && { breakdown: err.breakdown }),
    });
  }
};

const validateTransportData = async (req, res, next) => {
  try {
    console.log("🚀 Starting transport data validation...");

    const transports = req.body.transports;

    if (!Array.isArray(transports) || transports.length === 0) {
      console.log("ℹ️ No transports provided or transports array is empty. Skipping validation.");
      return next(); // allow empty transports if it's optional
    }

    console.log(`🔍 Validating ${transports.length} transport items...`);

    for (const [index, transportItem] of transports.entries()) {
      console.log(`📝 Validating transport item at index ${index}:`, transportItem);

      const { transport_id, quantity, transport_price } = transportItem;

      if (!transport_id || transport_price === undefined) {
        console.log(`❌ Transport item at index ${index} has invalid quantity (0) or missing required fields.`);
        return res.status(400).json({
          success: false,
          message: `Transport item at index ${index} has invalid quantity (0) or missing required fields.`
        });
      }

      console.log(`🔍 Fetching transport record for transport_id: ${transport_id}...`);
      const transport = await Transport.findByPk(transport_id);

      if (!transport) {
        console.log(`❌ Transport with ID ${transport_id} not found.`);
        return res.status(404).json({
          success: false,
          message: `Transport with ID ${transport_id} not found.`
        });
      }

      console.log(`✅ Transport record found:`, transport);

      const expectedPrice = parseFloat(transport.amount) * parseInt(quantity);
      const givenPrice = parseFloat(transport_price);

      console.log(`🔢 Calculating price for transport item at index ${index}:`);
      console.log(`   - Expected price: ${expectedPrice}`);
      console.log(`   - Given price: ${givenPrice}`);

      if (Math.abs(expectedPrice - givenPrice) > 1) {
        console.log(`❌ Price mismatch for transport item at index ${index}.`);
        return res.status(400).json({
          success: false,
          message: `Transport price mismatch at index ${index}: expected ${expectedPrice}, got ${givenPrice}`
        });
      }

      console.log(`✅ Price validation passed for transport item at index ${index}.`);
    }

    console.log("✅ All transport items validated successfully.");
    next();
  } catch (err) {
    console.error("❌ Transport validation error:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error during transport validation."
    });
  }
};

const validateTransportDataRound = async (transports, type) => {
  if (!Array.isArray(transports)) {
    console.log(`ℹ️ No transports provided for ${type} booking or transports is not an array.`);
    return;
  }

  console.log(`🔍 Validating ${transports.length} transport items for ${type} booking...`);

  for (const [index, transport] of transports.entries()) {
    console.log(`📝 Validating transport item at index ${index}:`, transport);

    const { transport_id, quantity, transport_price } = transport;

    if (!transport_id || quantity === undefined || transport_price === undefined) {
      console.log(`❌ Missing required fields in transport item at index ${index}.`);
      throw new Error(
        `Missing fields in ${type} transport at index ${index} (id, quantity, or price)`
      );
    }

    console.log(`🔍 Fetching transport record for transport_id: ${transport_id}...`);
    const transportRecord = await Transport.findByPk(transport_id);

    if (!transportRecord) {
      console.log(`❌ Transport with ID ${transport_id} not found.`);
      throw new Error(`Transport ID ${transport_id} not found in ${type} booking`);
    }

    console.log(`✅ Transport record found:`, transportRecord);

    const expectedPrice = parseFloat(transportRecord.amount) * Number(quantity);
    const givenPrice = parseFloat(transport_price);

    console.log(`🔢 Calculating price for transport item at index ${index}:`);
    console.log(`   - Expected price: ${expectedPrice}`);
    console.log(`   - Given price: ${givenPrice}`);

    if (Math.abs(expectedPrice - givenPrice) > 1) {
      console.log(`❌ Price mismatch for transport item at index ${index}.`);
      throw new Error(
        `Transport price mismatch in ${type} booking at index ${index}: expected ${expectedPrice}, got ${givenPrice}`
      );
    }

    console.log(`✅ Price validation passed for transport item at index ${index}.`);
  }

  console.log(`✅ All transport items validated successfully for ${type} booking.`);
};

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

    // ✅ Add this block to validate ticket_id format
    if (!/^GG-OW/.test(ticket_id)) {
      console.log("❌ Invalid ticket_id format:", ticket_id);
      return res.status(400).json({
        error: "Invalid ticket_id format",
        message: "ticket_id must start with 'GG-OW'",
        provided: ticket_id,
      });
    }

    console.log("🧳 Validating passengers data...");
    if (!Array.isArray(passengers)) {
      console.log("❌ Passengers data is not an array.");
      return res.status(400).json({
        error: "Invalid passengers data",
        message: "Passengers should be provided as an array",
      });
    }

    for (let i = 0; i < passengers.length; i++) {
      const passenger = passengers[i];

      console.log(`🔍 Validating passenger at index ${i}:`, passenger);

      // Optional: Enable this if needed
      // if (!passenger.name || !passenger.passenger_type || !passenger.nationality) {
      //   console.log(
      //     `❌ Passenger validation failed at index ${i}: Missing required fields.`,
      //     passenger
      //   );
      //   return res.status(400).json({
      //     error: "Invalid passenger data",
      //     message: `Passenger at index ${i} is missing required fields (name, passenger_type, nationality)`,
      //     passenger,
      //   });
      // }
    }

    console.log("✅ All validations passed.");
    next();
  } catch (error) {
    console.error("❌ Error in booking validation:", error);
    return res.status(500).json({
      error: "Validation error",
      details: error.message,
    });
  }
};;


// const validateRoundTripBookingPost = async (req, res, next) => {
//   console.log("\n=== Starting Round Trip Booking Post Validation ===");

//   try {
//     const { departure, return: returnBooking } = req.body;
//     console.log("📝 Validating round trip booking...");

//     if (!departure || !returnBooking) {
//       return res.status(400).json({
//         status: "error",
//         message: "Both departure and return booking details are required"
//       });
//     }

//     if (departure.ticket_total === 0 || returnBooking.ticket_total === 0) {
//       return res.status(400).json({
//         status: "error",
//         message: "Ticket total cannot be 0"
//       });
//     }

//     if (typeof departure !== "object" || typeof returnBooking !== "object") {
//       return res.status(400).json({
//         status: "error",
//         message: "Departure and return must be objects containing booking details"
//       });
//     }

//     const validateSchedule = async (scheduleId, type) => {
//       const schedule = await Schedule.findOne({ where: { id: scheduleId } });
//       if (!schedule) {
//         throw {
//           status: "error",
//           message: `Invalid schedule_id in ${type} booking. Schedule ID '${scheduleId}' does not exist.`
//         };
//       }
//     };

//     const validateTransportData = async (transports, type) => {
//       if (!Array.isArray(transports)) return;

//       for (const [index, transport] of transports.entries()) {
//         const { transport_id, quantity, transport_price } = transport;

//         if (!transport_id || quantity === undefined || transport_price === undefined) {
//           throw {
//             status: "error",
//             message: `Missing fields in ${type} transport at index ${index}`
//           };
//         }

//         const transportRecord = await Transport.findByPk(transport_id);
//         if (!transportRecord) {
//           throw {
//             status: "error",
//             message: `Transport ID ${transport_id} not found in ${type} booking`
//           };
//         }

//         const expectedPrice = parseFloat(transportRecord.amount) * Number(quantity);
//         const givenPrice = parseFloat(transport_price);

//         if (Math.abs(expectedPrice - givenPrice) > 1) {
//           throw {
//             status: "error",
//             message: `Transport price mismatch in ${type} booking at index ${index}: expected ${expectedPrice}, got ${givenPrice}`
//           };
//         }
//       }
//     };

//     const validateBooking = async (booking, type) => {
//       console.log(`📝 Validating ${type} booking...`);;

//       const requiredFields = [
//         "schedule_id", "total_passengers", "booking_date", "gross_total",
//         "ticket_total", "payment_status", "contact_name",
//         "adult_passengers", "child_passengers", "infant_passengers",
//         "payment_method", "booking_source", "ticket_id", "bank_fee",
//         "currency", "gross_total_in_usd", 
//       ];

//       const missingFields = requiredFields.filter((field) => {
//         const value = booking[field];
//         return value === undefined || value === null || value === "";
//       });

//       if (missingFields.length > 0) {
//         throw {
//           status: "error",
//           message: `Missing required fields in ${type} booking: ${missingFields.join(", ")}`
//         };
//       }

//       await validateSchedule(booking.schedule_id, type);

//       if (booking.transports && booking.transports.length > 0) {
//         await validateTransportData(booking.transports, type);
//       }
//     };

//     await validateBooking(departure, "departure");
//     await validateBooking(returnBooking, "return");

//     console.log("✅ All validations passed");
//     next();
//   } catch (error) {
//     console.error("❌ Validation error:", error);
//     return res.status(400).json({
//       status: "error",
//       message: error.message || "Validation failed",
//       details: error
//     });
//   }
// };





const validateRoundTripBookingPost = async (req, res, next) => {
  console.log("\n=== 🧾 Starting Round Trip Booking Post Validation ===");

  try {
    const { departure, return: returnBooking } = req.body;

    console.log("📨 Received departure:", departure?.ticket_id || 'N/A');
    console.log("📨 Received return:", returnBooking?.ticket_id || 'N/A');

    if (!departure || !returnBooking) {
      console.log("❌ Missing departure or return booking object.");
      return res.status(400).json({
        status: "error",
        message: "Both departure and return booking details are required"
      });
    }

    if (departure.ticket_total === 0) {
      console.log(`❌ Departure booking [${departure.ticket_id}] has ticket_total = 0`);
      return res.status(400).json({
        status: "error",
        message: `Ticket total cannot be 0 for departure booking (ticket_id: ${departure.ticket_id})`
      });
    }
    
    if (returnBooking.ticket_total === 0) {
      console.log(`❌ Return booking [${returnBooking.ticket_id}] has ticket_total = 0`);
      return res.status(400).json({
        status: "error",
        message: `Ticket total cannot be 0 for return booking (ticket_id: ${returnBooking.ticket_id})`
      });
    }
    
    if (typeof departure !== "object" || typeof returnBooking !== "object") {
      console.log("❌ Booking format error: Not an object.");
      return res.status(400).json({
        status: "error",
        message: "Departure and return must be objects containing booking details"
      });
    }

    const validateSchedule = async (scheduleId, type) => {
      console.log(`🔎 Validating schedule for ${type} - ID: ${scheduleId}`);
      const schedule = await Schedule.findOne({ where: { id: scheduleId } });
      if (!schedule) {
        console.log(`❌ Schedule ID ${scheduleId} not found for ${type}`);
        throw {
          status: "error",
          message: `Invalid schedule_id in ${type} booking. Schedule ID '${scheduleId}' does not exist.`
        };
      }
      console.log(`✅ Schedule ID ${scheduleId} found for ${type}`);
    };

    const validateTransportData = async (transports, type) => {
      if (!Array.isArray(transports)) return;
      console.log(`🔍 Validating ${transports.length} transport items for ${type}`);

      for (const [index, transport] of transports.entries()) {
        const { transport_id, quantity, transport_price } = transport;

        console.log(`🚐 Transport [${type}] #${index + 1}:`, transport);

        if (!transport_id || quantity === undefined || transport_price === undefined) {
          console.log(`❌ Missing field in transport ${index} for ${type}`);
          throw {
            status: "error",
            message: `Missing fields in ${type} transport at index ${index}`
          };
        }

        const transportRecord = await Transport.findByPk(transport_id);
        if (!transportRecord) {
          console.log(`❌ Transport ID ${transport_id} not found in DB for ${type}`);
          throw {
            status: "error",
            message: `Transport ID ${transport_id} not found in ${type} booking`
          };
        }

        const expectedPrice = parseFloat(transportRecord.amount) * Number(quantity);
        const givenPrice = parseFloat(transport_price);

        const isZeroAllowed = expectedPrice === 0 && givenPrice === 0;

        if (!isZeroAllowed && Math.abs(expectedPrice - givenPrice) > 1) {
          console.log(`❌ Price mismatch in transport ${index} for ${type}: expected ${expectedPrice}, got ${givenPrice}`);
          throw {
            status: "error",
            message: `Transport price mismatch in ${type} booking at index ${index}: expected ${expectedPrice}, got ${givenPrice}`
          };
        }

        console.log(`✅ Transport #${index + 1} validated for ${type}`);
      }
    };

    const validateBooking = async (booking, type) => {
      console.log(`📦 Validating ${type} booking fields...`);

      const requiredFields = [
        "schedule_id", "total_passengers", "booking_date", "gross_total",
        "ticket_total", "payment_status", "contact_name",
        "adult_passengers", "child_passengers", "infant_passengers",
        "payment_method", "booking_source", "ticket_id", "bank_fee",
        "currency", "gross_total_in_usd"
      ];

      const missingFields = requiredFields.filter((field) => {
        const value = booking[field];
        return value === undefined || value === null || value === "";
      });

      if (missingFields.length > 0) {
        console.log(`❌ Missing required fields in ${type}:`, missingFields);
        throw {
          status: "error",
          message: `Missing required fields in ${type} booking: ${missingFields.join(", ")}`
        };
      }

      await validateSchedule(booking.schedule_id, type);

      if (booking.transports?.length > 0) {
        await validateTransportData(booking.transports, type);
      }

      console.log(`✅ ${type} booking passed all checks.`);
    };

    await validateBooking(departure, "departure");
    await validateBooking(returnBooking, "return");

    console.log("✅ All round-trip booking validations passed.");
    next();
  } catch (error) {
    console.error("❌ Round Trip Validation Error:", error?.message || error);
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
        if (!transport.transport_price ) {
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
      // if (!p.name || !p.passenger_type || !p.nationality || !p.passport_id) {
      //   return res.status(400).json({
      //     error: "Invalid passenger data",
      //     message: `Passenger at index ${i} is missing required fields (name, passenger_type, nationality, or passport_id)`,
      //     passenger: p,
      //   });
      // }

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
    // const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    // if (!emailRegex.test(contact_email)) {
    //   return res.status(400).json({
    //     error: "Invalid email format",
    //   });
    // }

    // Validate phone number format
    console.log("📱 Validating phone number...");
    // const phoneRegex = /^[+]?[\d\s-]{8,}$/;
    // if (!phoneRegex.test(contact_phone)) {
    //   return res.status(400).json({
    //     error: "Invalid phone number format",
    //     message:
    //       "Phone number should contain at least 8 digits and may include +, spaces, or hyphens",
    //   });
    // }

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

    // if (gross_total && (isNaN(gross_total) || parseFloat(gross_total) <= 0)) {
    //   return res.status(400).json({
    //     error: "Invalid gross total",
    //     message: "Gross total must be a positive number",
    //   });
    // }

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
  validateTransportData,
  validateSingleBookingGrossTotal,validateTransportDataRound,
  validateRoundTripBookingPost, validateRoundTripGrossTotal

};
