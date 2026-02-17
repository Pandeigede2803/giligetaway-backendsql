const { Op } = require('sequelize');
const {
  Schedule,
  SubSchedule,
  User,
  Boat,
  Transit,
  SeatAvailability,
  Destination,
  Passenger,
  Booking,
  sequelize,
} = require("../models");
const { uploadImageToImageKit } = require("../middleware/upload");
const { processBookedSeats } = require("../util/seatUtils");
const { getDay } = require('date-fns');


// ============= HELPER FUNCTION TO GET SEASON NAME =============
const getSeason = (date) => {
  const month = new Date(date).getMonth() + 1;
  
  const lowSeasonMonths = process.env.LOW_SEASON_MONTHS.split(",").map(Number);
  const highSeasonMonths = process.env.HIGH_SEASON_MONTHS.split(",").map(Number);
  const peakSeasonMonths = process.env.PEAK_SEASON_MONTHS.split(",").map(Number);

  if (lowSeasonMonths.includes(month)) {
    return "low_season";
  } else if (highSeasonMonths.includes(month)) {
    return "high_season";
  } else if (peakSeasonMonths.includes(month)) {
    return "peak_season";
  } else {
    return "unknown";
  }
};

// ============= VALIDATE PASSENGER COUNTS =============
const validatePassengerCounts = (adult_passengers, child_passengers, infant_passengers, total_passengers) => {
  const calculatedTotal = adult_passengers + child_passengers + infant_passengers;
  
  if (calculatedTotal !== total_passengers) {
    throw new Error(`Passenger count mismatch. Adult(${adult_passengers}) + Child(${child_passengers}) + Infant(${infant_passengers}) = ${calculatedTotal}, but total_passengers is ${total_passengers}`);
  }

  if (adult_passengers < 1) {
    throw new Error("At least one adult passenger is required");
  }

  return true;
};


// ============= SEASON PRICE UTILITY =============
// ============= SEASON PRICE UTILITY =============
const getSeasonPrice = (date, lowSeasonPrice, highSeasonPrice, peakSeasonPrice) => {
  const month = new Date(date).getMonth() + 1; // getMonth() is zero-based, so adding 1
  
  // Get season months from environment variables
  const lowSeasonMonths = process.env.LOW_SEASON_MONTHS.split(",").map(Number);
  const highSeasonMonths = process.env.HIGH_SEASON_MONTHS.split(",").map(Number);
  const peakSeasonMonths = process.env.PEAK_SEASON_MONTHS.split(",").map(Number);

  // Check which season the current month falls into
  if (lowSeasonMonths.includes(month)) {
    return lowSeasonPrice || "N/A";
  } else if (highSeasonMonths.includes(month)) {
    return highSeasonPrice || "N/A";
  } else if (peakSeasonMonths.includes(month)) {
    return peakSeasonPrice || "N/A";
  } else {
    return "N/A";
  }
};

// ============= GET SCHEDULE DATA UTILITY =============
const getScheduleData = async (schedule_id, subschedule_id = null) => {
  try {
    let scheduleData = null;

    if (subschedule_id && subschedule_id !== null && subschedule_id !== undefined) {
      // Get subschedule data
      scheduleData = await SubSchedule.findByPk(subschedule_id, {
        include: [
          {
            model: Schedule,
            as: 'Schedule'
          }
        ]
      });

      if (!scheduleData) {
        throw new Error(`SubSchedule with ID ${subschedule_id} not found`);
      }

      console.log(`Using SubSchedule pricing for subschedule_id: ${subschedule_id}`);
    } else {
      // Get main schedule data when subschedule_id is null/undefined/not provided
      scheduleData = await Schedule.findByPk(schedule_id);

      if (!scheduleData) {
        throw new Error(`Schedule with ID ${schedule_id} not found`);
      }

      console.log(`Using Main Schedule pricing for schedule_id: ${schedule_id}`);
    }

    return scheduleData;
  } catch (error) {
    console.error("Error getting schedule data:", error.message);
    throw error;
  }
};

// ============= CALCULATE TICKET TOTAL UTILITY =============
const calculateTicketTotal = async (
  schedule_id, subschedule_id = null, booking_date, adult_passengers, child_passengers, infant_passengers = 0) => {
  try {
    // 1. Get schedule data
    const scheduleData = await getScheduleData(schedule_id, subschedule_id);

    // 2. Determine which schedule type and extract flat pricing
    let scheduleType;
    let priceData;

    if (subschedule_id && subschedule_id !== null && subschedule_id !== undefined) {
      scheduleType = "subschedule";
      priceData = {
        lowSeasonPrice: scheduleData.low_season_price,
        highSeasonPrice: scheduleData.high_season_price,
        peakSeasonPrice: scheduleData.peak_season_price,
      };
    } else {
      scheduleType = "main_schedule";
      priceData = {
        lowSeasonPrice: scheduleData.low_season_price,
        highSeasonPrice: scheduleData.high_season_price,
        peakSeasonPrice: scheduleData.peak_season_price,
      };
    }

    // 3. Get ticket price based on season
    const flatPrice = getSeasonPrice(
      booking_date,
      priceData.lowSeasonPrice,
      priceData.highSeasonPrice,
      priceData.peakSeasonPrice
    );

    // 4. Validate price
    if (flatPrice === "N/A" || !flatPrice) {
      throw new Error("No valid price available for the selected date");
    }

    // 5. Calculate total ticket cost (all passengers same price)
    const totalPassengers = adult_passengers + child_passengers + infant_passengers;
    const ticketTotal = parseFloat(flatPrice) * totalPassengers;

    console.log(`🎟️ Ticket Total Calculation (${scheduleType}):
      - Schedule ID: ${schedule_id}
      - SubSchedule ID: ${subschedule_id || 'N/A (Main Route)'}
      - Price per passenger: ${flatPrice}
      - Total passengers: ${totalPassengers}
      - Total: ${ticketTotal}`);

    // 6. Return result
    return {
      success: true,
      ticketTotal,
      breakdown: {
        flatPrice: parseFloat(flatPrice),
        totalPassengers,
        total: ticketTotal,
      },
      scheduleInfo: {
        schedule_id,
        subschedule_id: subschedule_id || null,
        departure_date: booking_date,
        season: getSeason(booking_date),
        schedule_type: scheduleType,
      },
    };
  } catch (error) {
    console.error("❌ Error calculating ticket total:", error.message);
    return {
      success: false,
      error: error.message,
      ticketTotal: 0,
    };
  }
};

const generateOneWayTicketId = async () => {
  try {
    let ticketId;
    let exists = true;

    while (exists) {
      // ✅ Generate random 6 digit (100000-999999)
      const random6Digit = (100000 + Math.floor(Math.random() * 900000)).toString();
      ticketId = `GG-OW-${random6Digit}`;

      // Check collision di DB
      exists = await Booking.findOne({ where: { ticket_id: ticketId } });
      // If collision (very rare), loop akan retry dengan random baru
    }

    console.log(`✅ Generated ticket ID: ${ticketId}`);
    return ticketId;
  } catch (error) {
    console.error("❌ Error generating one-way ticket ID:", error);
    throw new Error("Failed to generate one-way ticket ID");
  }
};

const generateRoundTripTicketIds = async (req, res) => {
  try {
    // Dapatkan timestamp saat ini
    const now = Date.now();

    // Fungsi untuk menghasilkan 6 digit acak yang valid
    const generateValidSixDigits = () => {
      let randomNum;
      let attempts = 0;
      const maxAttempts = 50;

      do {
        attempts++;
        // Angka acak antara 100000-999999
        randomNum = 100000 + Math.floor(Math.random() * 900000);

        // Pastikan angka ganjil untuk tiket keberangkatan
        if (randomNum % 2 === 0) randomNum++;

        // console.log(`🔍 Checking number: ${randomNum}, ends with: ${randomNum.toString().slice(-2)}`);

        // ✨ VALIDASI UTAMA: Pastikan tidak berakhir 99
        // Karena jika berakhir 99, maka pasangannya akan berakhir 00
        if (randomNum.toString().endsWith("99")) {
          console.log(
            `❌ Number ${randomNum} ends with 99, will cause 00 pair. Regenerating...`
          );
          continue;
        }

        // ✨ VALIDASI TAMBAHAN: Pastikan pasangan tidak berakhir 00
        const pairedNumber = randomNum + 1;
        if (pairedNumber.toString().endsWith("00")) {
          console.log(
            `❌ Paired number ${pairedNumber} ends with 00. Regenerating...`
          );
          continue;
        }

        // // Jika sampai sini, berarti valid
        // console.log(`✅ Valid number found: ${randomNum}, pair: ${pairedNumber}`);
        break;
      } while (attempts < maxAttempts);

      if (attempts >= maxAttempts) {
        throw new Error(
          "Could not generate valid number after maximum attempts"
        );
      }

      return randomNum;
    };

    let baseNumber = generateValidSixDigits();
    let ticketIdDeparture = "";
    let ticketIdReturn = "";
    let attempts = 0;
    const maxAttempts = 100;

    while (attempts < maxAttempts) {
      attempts++;

      // Pastikan baseNumber selalu ganjil (sudah dihandle di generateValidSixDigits)
      if (baseNumber % 2 === 0) baseNumber++;

      // ✨ DOUBLE CHECK: Pastikan tidak berakhir 99
      if (baseNumber.toString().endsWith("99")) {
        console.log(
          `🔄 Base number ${baseNumber} ends with 99, regenerating...`
        );
        baseNumber = generateValidSixDigits();
        continue;
      }

      // Buat ticket ID dengan format: GG-RT-XXXXXX
      ticketIdDeparture = `GG-RT-${baseNumber}`;
      ticketIdReturn = `GG-RT-${baseNumber + 1}`;

      console.log(
        `🔄 Mencoba pasangan ID ke-${attempts}: ${ticketIdDeparture} dan ${ticketIdReturn}`
      );

      // ✨ VALIDASI AKHIR: Pastikan return ticket tidak berakhir 00
      if ((baseNumber + 1).toString().endsWith("00")) {
        console.log(
          `❌ Return ticket ${ticketIdReturn} ends with 00, regenerating base number...`
        );
        baseNumber = generateValidSixDigits();
        continue;
      }

      // Cek apakah ID sudah ada di database
      const existing = await Booking.findAll({
        where: {
          ticket_id: {
            [Op.in]: [ticketIdDeparture, ticketIdReturn],
          },
        },
      });

      // Jika tidak ada yang sama, keluar dari loop
      if (existing.length === 0) {
        console.log(
          `✅ Menemukan pasangan ID yang tersedia: ${ticketIdDeparture} dan ${ticketIdReturn}`
        );
        console.log(
          `🎯 Final validation - Departure ends with: ${baseNumber
            .toString()
            .slice(-2)}, Return ends with: ${(baseNumber + 1)
            .toString()
            .slice(-2)}`
        );
        break;
      }

      console.log(`⚠️ ID sudah digunakan, mencoba pasangan berikutnya...`);

      // Jika terjadi konflik, buat nomor acak baru sepenuhnya
      baseNumber = generateValidSixDigits();
    }

    // Jika mencapai batas percobaan, beri tahu pengguna
    if (attempts >= maxAttempts) {
      return res.status(500).json({
        error: "Could not generate unique ticket IDs",
        message: "Reached maximum attempts",
      });
    }

    // ✨ FINAL SAFETY CHECK sebelum return
    const finalDepartureEnding = baseNumber.toString().slice(-2);
    const finalReturnEnding = (baseNumber + 1).toString().slice(-2);

    if (finalReturnEnding === "00") {
      console.error(
        `🚨 CRITICAL ERROR: About to return ticket ending with 00!`
      );
      return res.status(500).json({
        error: "Generated invalid ticket ending with 00",
        message: "Internal validation failed",
      });
    }

    console.log(`🎉 SUCCESS: Generated valid ticket pair`);
    console.log(
      `📋 Departure: ${ticketIdDeparture} (ends with: ${finalDepartureEnding})`
    );
    console.log(
      `📋 Return: ${ticketIdReturn} (ends with: ${finalReturnEnding})`
    );

    return res.json({
      ticket_id_departure: ticketIdDeparture,
      ticket_id_return: ticketIdReturn,
      timestamp: new Date().toISOString(),
      validation: {
        departure_ending: finalDepartureEnding,
        return_ending: finalReturnEnding,
        is_valid:
          finalReturnEnding !== "00" && !finalDepartureEnding.endsWith("99"),
      },
    });
  } catch (error) {
    console.error("❌ Error generating round-trip ticket IDs:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: error.message,
    });
  }
};

/**
 * Generate paired round-trip ticket IDs for agent bookings
 * Returns { ticket_id_departure, ticket_id_return }
 */
const generateAgentRoundTripTicketId = async () => {
  const generateValidSixDigits = () => {
    let randomNum;
    let attempts = 0;
    const maxAttempts = 50;

    do {
      attempts++;
      randomNum = 100000 + Math.floor(Math.random() * 900000);

      // Ensure odd number for departure ticket
      if (randomNum % 2 === 0) randomNum++;

      // Validate: must not end with 99 (would cause return ticket to end with 00)
      if (randomNum.toString().endsWith("99")) {
        continue;
      }

      // Validate: paired number must not end with 00
      const pairedNumber = randomNum + 1;
      if (pairedNumber.toString().endsWith("00")) {
        continue;
      }

      break;
    } while (attempts < maxAttempts);

    if (attempts >= maxAttempts) {
      throw new Error("Could not generate valid number after maximum attempts");
    }

    return randomNum;
  };

  let baseNumber = generateValidSixDigits();
  let ticketIdDeparture = "";
  let ticketIdReturn = "";
  let attempts = 0;
  const maxAttempts = 100;

  while (attempts < maxAttempts) {
    attempts++;

    // Ensure baseNumber is always odd
    if (baseNumber % 2 === 0) baseNumber++;

    // Double check: must not end with 99
    if (baseNumber.toString().endsWith("99")) {
      baseNumber = generateValidSixDigits();
      continue;
    }

    // Create ticket IDs with format: GG-RT-XXXXXX (same as regular round-trip)
    ticketIdDeparture = `GG-RT-${baseNumber}`;
    ticketIdReturn = `GG-RT-${baseNumber + 1}`;

    // Final validation: return ticket must not end with 00
    if ((baseNumber + 1).toString().endsWith("00")) {
      baseNumber = generateValidSixDigits();
      continue;
    }

    // Check if IDs already exist in database
    const existing = await Booking.findAll({
      where: {
        ticket_id: {
          [Op.in]: [ticketIdDeparture, ticketIdReturn],
        },
      },
    });

    // If no conflicts, we're done
    if (existing.length === 0) {
      console.log(
        `✅ Generated agent round-trip pair: ${ticketIdDeparture} and ${ticketIdReturn}`
      );
      break;
    }

    // If conflict, regenerate base number
    baseNumber = generateValidSixDigits();
  }

  if (attempts >= maxAttempts) {
    throw new Error("Could not generate unique agent round-trip ticket IDs");
  }

  // Final safety check
  const finalReturnEnding = (baseNumber + 1).toString().slice(-2);
  if (finalReturnEnding === "00") {
    throw new Error("Generated invalid ticket ending with 00");
  }

  return {
    ticket_id_departure: ticketIdDeparture,
    ticket_id_return: ticketIdReturn,
  };
};



module.exports = {
  calculateTicketTotal,
  getSeasonPrice,
  getScheduleData,
  getSeason,
  generateOneWayTicketId,
  generateRoundTripTicketIds,
  generateAgentRoundTripTicketId,
  validatePassengerCounts
};