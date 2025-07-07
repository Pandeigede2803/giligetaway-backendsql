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
            as: 'schedule'
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
const calculateTicketTotal = async (schedule_id, subschedule_id = null, booking_date, adult_passengers, child_passengers, infant_passengers = 0) => {
  try {
    // 1. Get schedule data
    const scheduleData = await getScheduleData(schedule_id, subschedule_id);
    
    // 2. Extract price data based on schedule type
    let priceData;
    let scheduleType;
    
    if (subschedule_id && subschedule_id !== null && subschedule_id !== undefined) {
      // For subschedule, use subschedule prices
      scheduleType = "subschedule";
      priceData = {
        lowSeasonPrice: scheduleData.adult_low_season_price,
        highSeasonPrice: scheduleData.adult_high_season_price,
        peakSeasonPrice: scheduleData.adult_peak_season_price,
        childLowSeasonPrice: scheduleData.child_low_season_price,
        childHighSeasonPrice: scheduleData.child_high_season_price,
        childPeakSeasonPrice: scheduleData.child_peak_season_price
      };
    } else {
      // For main schedule, use main schedule prices
      scheduleType = "main_schedule";
      priceData = {
        lowSeasonPrice: scheduleData.adult_low_season_price,
        highSeasonPrice: scheduleData.adult_high_season_price,
        peakSeasonPrice: scheduleData.adult_peak_season_price,
        childLowSeasonPrice: scheduleData.child_low_season_price,
        childHighSeasonPrice: scheduleData.child_high_season_price,
        childPeakSeasonPrice: scheduleData.child_peak_season_price
      };
    }

    // 3. Calculate adult ticket price based on season
    const adultPrice = getSeasonPrice(
      booking_date,
      priceData.lowSeasonPrice,
      priceData.highSeasonPrice,
      priceData.peakSeasonPrice
    );

    // 4. Calculate child ticket price based on season
    const childPrice = getSeasonPrice(
      booking_date,
      priceData.childLowSeasonPrice,
      priceData.childHighSeasonPrice,
      priceData.childPeakSeasonPrice
    );

    // 5. Validate prices
    if (adultPrice === "N/A") {
      throw new Error("Adult price not available for the selected date");
    }
    if (child_passengers > 0 && childPrice === "N/A") {
      throw new Error("Child price not available for the selected date");
    }

    // 6. Calculate total for each passenger type
    const adultTotal = parseFloat(adultPrice) * adult_passengers;
    const childTotal = parseFloat(childPrice) * child_passengers;
    const infantTotal = 0; // Infants are free

    // 7. Calculate grand total
    const ticketTotal = adultTotal + childTotal + infantTotal;

    console.log(`Ticket Total Calculation (${scheduleType}):
      - Schedule ID: ${schedule_id}
      - SubSchedule ID: ${subschedule_id || 'N/A (Main Route)'}
      - Adult: ${adult_passengers} x ${adultPrice} = ${adultTotal}
      - Child: ${child_passengers} x ${childPrice} = ${childTotal}
      - Infant: ${infant_passengers} x 0 = ${infantTotal}
      - Total: ${ticketTotal}`);

    return {
      success: true,
      ticketTotal,
      breakdown: {
        adultPrice: parseFloat(adultPrice),
        childPrice: parseFloat(childPrice),
        infantPrice: 0,
        adultTotal,
        childTotal,
        infantTotal,
        totalPassengers: adult_passengers + child_passengers + infant_passengers
      },
      scheduleInfo: {
        schedule_id,
        subschedule_id: subschedule_id || null,
        booking_date,
        season: getSeason(booking_date),
        schedule_type: scheduleType
      }
    };

  } catch (error) {
    console.error("Error calculating ticket total:", error.message);
    return {
      success: false,
      error: error.message,
      ticketTotal: 0
    };
  }
};



module.exports = {
  calculateTicketTotal,
  getSeasonPrice,
  getScheduleData,
  getSeason,
  validatePassengerCounts
};