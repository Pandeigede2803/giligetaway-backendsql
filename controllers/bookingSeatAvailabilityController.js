const { SeatAvailability, BookingSeatAvailability, Booking, Passenger,Schedule, SubSchedule  } = require('../models');

const findSeatAvailabilityById = async (req, res) => {
    const { id } = req.params;

    try {
        // Fetch seat availability by ID
        const seatAvailability = await SeatAvailability.findOne({
            where: { id },
            include: [
                {
                    model: BookingSeatAvailability,
                    as: 'BookingSeatAvailabilities',
                    include: [{
                        model: Booking,
                        include:{
                            model: Passenger,
                            as: 'passengers'
                        }
                    }]
                }
            ]
        });

        if (!seatAvailability) {
            return res.status(404).json({
                status: 'fail',
                message: `Seat availability not found for ID ${id}.`
            });
        }

        // Extract booking IDs for the seat availability
        const bookings = seatAvailability.BookingSeatAvailabilities.map(bsa => bsa.booking_id);

        // Return seat availability details along with related booking IDs
        return res.status(200).json({
            status: 'success',
            message: 'Seat availability retrieved successfully',
            seat_availability: {
                ...seatAvailability.get({ plain: true }),
                bookings
            }
        });
    } catch (error) {
        console.log('Error finding seat availability:', error.message);
        return res.status(500).json({
            status: 'error',
            message: 'An error occurred while finding seat availability',
            error: error.message
        });
    }
};

const getFilteredBookingsBySeatAvailability = async (req, res) => {
  const { id } = req.params; // `id` here is the `seat_availability_id`

  try {
      // Fetch seat availability by ID
      const seatAvailability = await SeatAvailability.findOne({
          where: { id },
          include: [
              {
                  model: BookingSeatAvailability,
                  as: 'BookingSeatAvailabilities',
                  include: [
                      {
                          model: Booking,
                          include: [
                              {
                                  model: Passenger,
                                  as: 'passengers',
                              },
                              {
                                  model: Schedule,
                                  as: 'schedule',
                              },
                              {
                                  model: SubSchedule,
                                  as: 'subSchedule',
                              },
                          ]
                      }
                  ]
              }
          ]
      });

      if (!seatAvailability) {
          return res.status(404).json({
              status: 'fail',
              message: `Seat availability not found for ID ${id}.`
          });
      }

      // Separate bookings based on the presence of `subschedule_id`
      const bookingsWithSubSchedule = seatAvailability.BookingSeatAvailabilities
          .filter(bsa => bsa.Booking.subschedule_id !== null)
          .map(bsa => bsa.Booking);

      const bookingsWithoutSubSchedule = seatAvailability.BookingSeatAvailabilities
          .filter(bsa => bsa.Booking.subschedule_id === null)
          .map(bsa => bsa.Booking);

      return res.status(200).json({
          status: 'success',
          message: 'Filtered bookings retrieved successfully',
          bookings_with_subschedule: bookingsWithSubSchedule,
          bookings_without_subschedule: bookingsWithoutSubSchedule
      });
  } catch (error) {
      console.error('Error fetching filtered bookings:', error);
      return res.status(500).json({
          status: 'error',
          message: 'An error occurred while fetching filtered bookings',
          error: error.message
      });
  }
};
  

module.exports = {
    findSeatAvailabilityById,
    getFilteredBookingsBySeatAvailability
};
