// Function to check if a specific seat is available (REST endpoint version)
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

const {
  fetchSeatAvailability,
  createSeatAvailability,
} = require("../util/seatAvailabilityUtils");
const { processBookedSeats } = require("../util/seatUtils");

const isSeatAvailable = async (req, res) => {
  const { date, schedule_id, sub_schedule_id, seat_number } = req.query;
  console.log("Query Params:", { date, schedule_id, sub_schedule_id, seat_number });
  
  if (!seat_number) {
    return res.status(400).json({ 
      status: "error",
      message: "Seat number is required" 
    });
  }

  try {
    // Check SeatAvailability
    let seatAvailability = await fetchSeatAvailability({
      date,
      schedule_id,
      sub_schedule_id,
    });
    
    // If no SeatAvailability found, create new
    if (!seatAvailability) {
      console.log("🚨 SeatAvailability not found, creating new...");
      const result = await createSeatAvailability({
        schedule_id,
        date,
        qty: 0, // Use default quantity
      });
      seatAvailability = result.mainSeatAvailability;
    }
    
    // Query Passengers with the seat number to check if it's already booked
    const existingPassenger = await Passenger.findOne({
      where: {
        seat_number: seat_number
      },
      include: [
        {
          model: Booking,
          as: "booking",
          required: true,
          where: {
            payment_status: ["paid", "invoiced", "pending", "unpaid"],
          },
          include: [
            {
              model: SeatAvailability,
              as: "seatAvailabilities",
              required: true,
              where: {
                date,
                schedule_id,
                ...(sub_schedule_id && { subschedule_id: sub_schedule_id }),
              },
            },
          ],
        },
      ],
    });
    
    // Get boat information
    const schedule = await Schedule.findByPk(schedule_id, {
      attributes: ["id"],
      include: [
        {
          model: Boat,
          as: "Boat",
          required: true,
        },
      ],
    });
    
    // Get all booked seats to process with special rules
    const passengers = await Passenger.findAll({
      include: [
        {
          model: Booking,
          as: "booking",
          required: true,
          where: {
            payment_status: ["paid", "invoiced", "pending", "unpaid"],
          },
          include: [
            {
              model: SeatAvailability,
              as: "seatAvailabilities",
              required: true,
              where: {
                date,
                schedule_id,
                ...(sub_schedule_id && { subschedule_id: sub_schedule_id }),
              },
            },
          ],
        },
      ],
    });
    
    const bookedSeats = passengers.map((p) => p.seat_number).filter(Boolean);
    const boatData = schedule?.Boat || null;
    
    // Process booked seats with special rules (connected seats)
    const processedBookedSeats = processBookedSeats(
      new Set(bookedSeats),
      seatAvailability.boost,
      boatData
    );
    
    // Check if the requested seat is in the processed booked seats
    const isSeatBooked = processedBookedSeats.includes(seat_number);
    
    // Check if the seat number is valid (within total seats)
    const totalSeats = seatAvailability.available_seats || 0;
    const isSeatValid = isValidSeatNumber(seat_number, totalSeats, boatData);
    
    // Prepare response
    const response = {
      status: "success",
      message: isSeatBooked ? "This seat is already booked." : (isSeatValid ? "This seat is available." : "Invalid seat number."),
      isAvailable: !isSeatBooked && isSeatValid,
      requestedSeat: seat_number,
      seatAvailability: {
        totalSeats: totalSeats,
        availableSeatCount: totalSeats - bookedSeats.length,
        bookedSeatCount: bookedSeats.length,
      },
      boatDetails: schedule.Boat,
    };
    
    res.json(response);
  } catch (error) {
    console.error("❌ Error checking seat availability:", error.message);
    res.status(500).json({ 
      status: "error",
      message: "Failed to check seat availability.",
      error: error.message 
    });
  }
};

// Helper function to check if a seat number is valid
const isValidSeatNumber = (seatNumber, totalSeats, boatData) => {
  // This is a simplified validation
  // You might need to implement more complex validation based on your boat configuration
  
  // Basic validation: check if the seat exists in the boat's seating plan
  if (!seatNumber || !totalSeats) return false;
  
  // Extract numeric part from seat (assuming format like A1, B2, etc.)
  const match = seatNumber.match(/[A-Z]+(\d+)/);
  if (!match) return false;
  
  const seatNum = parseInt(match[1], 10);
  
  // Simple check if the seat number is within range
  // This should be expanded based on your specific boat seating layout
  return seatNum > 0 && seatNum <= totalSeats;
  
  // If you have specific seat layouts per boat, you could add logic like:
  // if (boatData && boatData.layout === 'specific_layout') {
  //   // Check against specific layout rules
  // }
};

// Utility version for internal use in other controllers
const checkSeatAvailability = async (seatData) => {
  const { date, schedule_id, sub_schedule_id, seat_number } = seatData;
  
  if (!seat_number) {
    return { isAvailable: false, message: "Seat number is required" };
  }

  try {
    // Check SeatAvailability
    let seatAvailability = await fetchSeatAvailability({
      date,
      schedule_id,
      sub_schedule_id,
    });
    
    // If no SeatAvailability found, create new
    if (!seatAvailability) {
      console.log("🚨 SeatAvailability not found, creating new...");
      const result = await createSeatAvailability({
        schedule_id,
        date,
        qty: 0, // Use default quantity
      });
      seatAvailability = result.mainSeatAvailability;
    }
    
    // Get boat information
    const schedule = await Schedule.findByPk(schedule_id, {
      attributes: ["id"],
      include: [
        {
          model: Boat,
          as: "Boat",
          required: true,
        },
      ],
    });
    
    // Get all booked seats
    const passengers = await Passenger.findAll({
      include: [
        {
          model: Booking,
          as: "booking",
          required: true,
          where: {
            payment_status: ["paid", "invoiced", "pending", "unpaid"],
          },
          include: [
            {
              model: SeatAvailability,
              as: "seatAvailabilities",
              required: true,
              where: {
                date,
                schedule_id,
                ...(sub_schedule_id && { subschedule_id: sub_schedule_id }),
              },
            },
          ],
        },
      ],
    });
    
    const bookedSeats = passengers.map((p) => p.seat_number).filter(Boolean);
    const boatData = schedule?.Boat || null;
    
    // Process booked seats with special rules (connected seats)
    const processedBookedSeats = processBookedSeats(
      new Set(bookedSeats),
      seatAvailability.boost,
      boatData
    );
    
    // Check if the requested seat is in the processed booked seats
    const isSeatBooked = processedBookedSeats.includes(seat_number);
    
    // Check if the seat number is valid (within total seats)
    const totalSeats = seatAvailability.available_seats || 0;
    const isSeatValid = isValidSeatNumber(seat_number, totalSeats, boatData);
    
    return {
      isAvailable: !isSeatBooked && isSeatValid,
      message: isSeatBooked ? "This seat is already booked." : (isSeatValid ? "This seat is available." : "Invalid seat number."),
      totalSeats: totalSeats,
      availableSeatCount: totalSeats - bookedSeats.length,
      bookedSeatCount: bookedSeats.length
    };
  } catch (error) {
    console.error("❌ Error checking seat availability:", error.message);
    return { 
      isAvailable: false, 
      message: "Error checking seat availability: " + error.message 
    };
  }
};

module.exports = {
  isSeatAvailable,
  checkSeatAvailability
};