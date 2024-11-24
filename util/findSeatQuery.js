const { sequelize, Booking, SeatAvailability,Destination,Transport, Schedule,SubSchedule,Transaction, Passenger,Transit, TransportBooking, AgentMetrics, Agent, BookingSeatAvailability, Boat } = require('../models');


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
              attributes: ['id', 'booking_date', 'ticket_id'],
              include: [
                {
                  model: Passenger,
                  as: 'passengers',
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
              ],
            },
          ],
        },
        {
          model: Schedule,
          as: 'Schedule',
          attributes: ['id'],
          include: [
            {
              model: Boat,
              as: 'Boat',
              attributes: ['capacity'],
            },
            {
              model: SubSchedule,
              as: 'SubSchedules',
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
              ],
            },
          ],
        },
      ],
    });

    return seatAvailability;
  } catch (error) {
    console.error('Error fetching seat availability details:', error);
    throw new Error('Database query failed');
  }
};

module.exports = { findSeatAvailabilityWithDetails };
