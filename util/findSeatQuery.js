const { sequelize, Booking, SeatAvailability,Destination,Transport, Schedule,SubSchedule,Transaction, Passenger,Transit, TransportBooking, AgentMetrics, Agent, BookingSeatAvailability, Boat, AgentCommission } = require('../models');


const {buildRouteFromSchedule} = require('../util/buildRoute');
const findSeatAvailabilityWithDetails = async (id) => {
  try {
    const seatAvailability = await SeatAvailability.findOne({
      where: { id },
      include: [
        {
          model: BookingSeatAvailability,
          as: 'BookingSeatAvailabilities',
          include: [
            {
              model: Booking,
              where: { payment_status: ['paid', 'invoiced'] },
              attributes: { exclude: [] }, // Include all attributes
              include: [
                {
                  model: Passenger,
                  as: 'passengers',
                  include: [
                    {
                      model: Booking,
                      as: 'booking',
                      attributes: ['id', 'schedule_id', 'subschedule_id'],
                    },
                  ],
                },
                {
                  model: AgentCommission,
                  as: 'agentCommissions',
                },
                {
                  model: TransportBooking,
                  as: 'transportBookings',
                  attributes: ['id', 'booking_id', 'transport_id', 'quantity', 'transport_price', 'transport_type', 'note'],
                  include: [
                    {
                      model: Transport,
                      as: 'transport',
                    },
                  ],
                },
                {
                  model: Agent,
                  as: 'Agent',
                  attributes: ['id', 'name', 'email', 'phone'],
                },
                {
                  model: Schedule,
                  as: 'schedule',
                  attributes: ['id', 'destination_from_id', 'destination_to_id'],
                  include: [
                    {
                      model: Destination,
                      as: 'FromDestination',
                      attributes: ['name'],
                    },
                    {
                      model: Destination,
                      as: 'ToDestination',
                      attributes: ['name'],
                    },
                    {
                      model: Transit,
                      as: 'Transits',
                      attributes: ['id', 'schedule_id', 'destination_id'],
                      include: [
                        {
                          model: Destination,
                          as: 'Destination',
                          attributes: ['name'],
                        },
                      ],
                    },
                  ],
                },
                {
                  model: SubSchedule,
                  as: 'subSchedule',
                  attributes: ['id'],
                  include: [
                    {
                      model: Destination,
                      as: 'DestinationFrom',
                      attributes: ['name'],
                    },
                    {
                      model: Destination,
                      as: 'DestinationTo',
                      attributes: ['name'],
                    },
                    {
                      model: Transit,
                      as: 'TransitFrom',
                      attributes: ['id', 'schedule_id', 'destination_id'],
                      include: [
                        {
                          model: Destination,
                          as: 'Destination',
                          attributes: ['name'],
                        },
                      ],
                    },
                    {
                      model: Transit,
                      as: 'TransitTo',
                      attributes: ['id'],
                      include: [
                        {
                          model: Destination,
                          as: 'Destination',
                          attributes: ['name'],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          model: Schedule,
          as: 'Schedule',
          attributes: ['id', 'destination_from_id', 'destination_to_id'],
          include: [
            {
              model: Destination,
              as: 'FromDestination',
              attributes: ['name'],
            },
            {
              model: Destination,
              as: 'ToDestination',
              attributes: ['name'],
            },
            {
              model: Transit,
              as: 'Transits',
              attributes: ['id', 'schedule_id', 'destination_id'],
              include: [
                {
                  model: Destination,
                  as: 'Destination',
                  attributes: ['name'],
                },
              ],
            },
          ],
        },
        {
          model: SubSchedule,
          as: 'SubSchedule',
          attributes: ['id'],
          include: [
            {
              model: Destination,
              as: 'DestinationFrom',
              attributes: ['name'],
            },
            {
              model: Destination,
              as: 'DestinationTo',
              attributes: ['name'],
            },
            {
              model: Transit,
              as: 'TransitFrom',
              attributes: ['id', 'schedule_id', 'destination_id'],
              include: [
                {
                  model: Destination,
                  as: 'Destination',
                  attributes: ['name'],
                },
              ],
            },
            {
              model: Transit,
              as: 'TransitTo',
              attributes: ['id'],
              include: [
                {
                  model: Destination,
                  as: 'Destination',
                  attributes: ['name'],
                },
              ],
            },
          ],
        },
      ],
    });

    if (!seatAvailability) {
      throw new Error("Seat Availability Not Found");
    }

    console.log('Seat availability details:', JSON.stringify(seatAvailability, null, 2));
    seatAvailability.BookingSeatAvailabilities.forEach((bookingSeat) => {
      const booking = bookingSeat.Booking;
    
      if (booking) {
        // ✅ Ensure `passengers` array exists
        const passengerCount = booking.passengers ? booking.passengers.length : 0;
        booking.setDataValue("passenger_count", passengerCount);
    
        // ✅ Ensure `route` is calculated correctly
        const route = buildRouteFromSchedule(booking.schedule, booking.subSchedule);
        booking.setDataValue("route", route);
    
        // 🔍 Debugging Log - Check the Data Before Returning
        console.log("Updated Booking with Route & Passenger Count:", {
          id: booking.id,
          passenger_count: booking.getDataValue("passenger_count"),
          route: booking.getDataValue("route"),
        });
      }
    });
    

    return seatAvailability;
  } catch (error) {
    console.error('Error fetching seat availability details:', error);
    throw new Error('Database query failed');
  }
};

module.exports = { findSeatAvailabilityWithDetails };
