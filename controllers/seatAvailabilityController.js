const {
  SeatAvailability,
  Schedule,
  Boat,
  Booking,
  SubSchedule,
  Transit,
  Destination,
  BookingSeatAvailability,
  Passenger,
} = require("../models"); // Adjust the path as needed

const checkAvailableSeats = async (req, res) => {
  const { schedule_id, booking_date } = req.query;

  try {
    let whereClause = {};
    if (schedule_id) {
      whereClause.schedule_id = schedule_id;
    }
    if (booking_date) {
      whereClause.date = booking_date;
    }

    // Fetch seat availability
    const seatAvailability = await SeatAvailability.findOne({
      where: whereClause,
    });

    if (!seatAvailability) {
      return res
        .status(404)
        .json({
          error: `Seat availability not found for schedule ID ${schedule_id} on date ${booking_date}.`,
        });
    }

    // Return available seats
    return res
      .status(200)
      .json({ available_seats: seatAvailability.available_seats });
  } catch (error) {
    console.log("Error checking available seats:", error.message);
    return res.status(500).json({ error: error.message });
  }
};

const checkAllAvailableSeats = async (req, res) => {
  const { schedule_id, booking_date } = req.query;

  try {
    let whereClause = {};
    if (schedule_id) {
      whereClause.schedule_id = schedule_id;
    }
    if (booking_date) {
      whereClause.date = booking_date;
    }

    // Fetch all seat availabilities for the given schedule_id and booking_date, including related details
    const seatAvailabilities = await SeatAvailability.findAll({
      where: whereClause,
      include: [
        {
          model: Schedule,
          include: [
            { model: Destination, as: "DestinationFrom" },
            { model: Destination, as: "DestinationTo" },
            { model: Boat, as: "Boat" },
          ],
        },
        { model: Transit },
        { model: SubSchedule },
      ],
    });

    if (seatAvailabilities.length === 0) {
      return res.status(404).json({
        status: "fail",
        message: `No seat availabilities found for schedule ID ${schedule_id} on date ${booking_date}.`,
      });
    }

    // Return total number of seat availabilities and details
    return res.status(200).json({
      status: "success",
      message: "Seat availabilities retrieved successfully",
      total_seat_availabilities: seatAvailabilities.length,
      seat_availabilities: seatAvailabilities,
    });
  } catch (error) {
    console.log("Error checking available seats:", error.message);
    return res.status(500).json({
      status: "error",
      message: "An error occurred while checking available seats",
      error: error.message,
    });
  }
};

const checkAllAvailableSeatsBookingCount = async (req, res) => {
  const { schedule_id, booking_date } = req.query;

  try {
    let whereClause = {};
    if (schedule_id) {
      whereClause.schedule_id = schedule_id;
    }
    if (booking_date) {
      whereClause.date = booking_date;
    }

    // Fetch all seat availabilities for the given schedule_id and booking_date, including related details
    const seatAvailabilities = await SeatAvailability.findAll({
      where: whereClause,
      include: [
        {
          model: Schedule,
          include: [
            { model: Destination, as: "DestinationFrom" },
            { model: Destination, as: "DestinationTo" },
            { model: Boat, as: "Boat" },
          ],
        },
        // { model: Transit },
        // { model: SubSchedule },
      ],
    });

    if (seatAvailabilities.length === 0) {
      return res.status(404).json({
        status: "fail",
        message: `No seat availabilities found for schedule ID ${schedule_id} on date ${booking_date}.`,
      });
    }

    // Fetch bookings for each seat availability
    const seatAvailabilitiesWithBookings = await Promise.all(
      seatAvailabilities.map(async (seatAvailability) => {
        const bookings = await BookingSeatAvailability.findAll({
          where: { seat_availability_id: seatAvailability.id },
          include: {
            model: Booking,
            attributes: ['id',
              'contact_name',
              'contact_phone',
              'contact_passport_id',
              'contact_nationality',
              'contact_email',
              'schedule_id',
              'agent_id',
              'payment_method',
              'gross_total',
              'total_passengers',
              'adult_passengers',
              'child_passengers',
              'infant_passengers',
              'payment_status',
              'booking_source',
              'booking_date',
              'ticket_id',
              'created_at',
              'updated_at'
            ],
            include: {
              model: Passenger,
              as:'passengers',
            }

          },
        });
        return {
          ...seatAvailability.get({ plain: true }),
          available_seats: seatAvailability.available_seats, // Ensure available_seats is included
          bookings: bookings.map(bsa => ({ id: bsa.Booking.id })),
        };
      })
    );

    // Return total number of seat availabilities and details
    return res.status(200).json({
      status: "success",
      message: "Seat availabilities retrieved successfully",
      total_seat_availabilities: seatAvailabilities.length,
      seat_availabilities: seatAvailabilitiesWithBookings,
    });
  } catch (error) {
    console.log("Error checking available seats:", error.message);
    return res.status(500).json({
      status: "error",
      message: "An error occurred while checking available seats",
      error: error.message,
    });
  }
};


module.exports = {
  checkAvailableSeats,
  checkAllAvailableSeats,
  checkAllAvailableSeatsBookingCount
};
