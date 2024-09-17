const { SeatAvailability, Schedule, SubSchedule, Boat } = require("../models");

// Create SeatAvailability if it does not exist
const createSeatAvailability = async (schedule_id, date, isSubSchedule = false) => {
  try {
    let schedule;
    
    // Fetch the schedule or subschedule and the boat capacity
    if (isSubSchedule) {
      schedule = await SubSchedule.findOne({
        where: { id: schedule_id },
        include: {
          model: Schedule,
          include: {
            model: Boat,
            attributes: ['capacity'],
          },
        },
      });
    } else {
      schedule = await Schedule.findOne({
        where: { id: schedule_id },
        include: {
          model: Boat,
          attributes: ['capacity'],
        },
      });
    }

    if (!schedule || !schedule.Boat) {
      throw new Error("Schedule or boat not found");
    }

    // Use the boat's capacity as the available seats
    const availableSeats = schedule.Boat.capacity;

    // Create the SeatAvailability entry
    const newSeatAvailability = await SeatAvailability.create({
      schedule_id,
      date,
      available_seats: availableSeats, // Use the boat capacity here
      availability: true
    });

    return newSeatAvailability;
  } catch (error) {
    throw new Error("Failed to create seat availability: " + error.message);
  }
};

// Check SeatAvailability based on schedule_id, passengers_total, and date
const checkSeatAvailability = async (schedule_id, passengers_total, date) => {
  const seatAvailability = await SeatAvailability.findOne({
    where: {
      schedule_id,
      date,
      available_seats: { [Op.gte]: passengers_total },
      availability: true
    }
  });

  return seatAvailability;
};

module.exports = { createSeatAvailability, checkSeatAvailability };
