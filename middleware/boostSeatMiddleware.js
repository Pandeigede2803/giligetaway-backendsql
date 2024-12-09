const { SeatAvailability, Schedule, Boat } = require('../models'); // Adjust paths as needed

const boostSeatMiddleware = async (req, res, next) => {
  const { schedule_id, subschedule_id, date } = req.body;

  try {


    if (!date) {
      return res.status(400).json({
        success: false,
        message: 'Date is required.',
      });
    }


    // Fetch the boat capacity from the schedule
    const schedule = await Schedule.findOne({
      where: { id: schedule_id },
      include: { model: Boat, as: 'Boat', attributes: ['capacity'] },
    });

    if (!schedule || !schedule.Boat) {
      return res.status(404).json({
        success: false,
        message: `Boat capacity not found for schedule ID ${schedule_id}.`,
      });
    }

    const boatCapacity = schedule.Boat.capacity;

    // Check if available_seats equals boat capacity
    if (seatAvailability.available_seats >= boatCapacity) {
      return res.status(400).json({
        success: false,
        message: 'The seat cannot be boosted because it is already at maximum capacity.',
      });
    }

    // Proceed to the next middleware or route handler
    next();
  } catch (error) {
    console.error('Error in checkSeatAvailabilityMiddleware:', error.message);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while checking seat availability.',
      error: error.message,
    });
  }
};

module.exports = boostSeatMiddleware;