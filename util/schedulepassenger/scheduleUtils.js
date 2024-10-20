const { sequelize, Booking, SeatAvailability, Destination, SubSchedule, Transport, Schedule, Passenger, Transit, TransportBooking, AgentMetrics, Agent, BookingSeatAvailability, Boat } = require('../../models');
const { Op } = require('sequelize');

const getSchedulesWithSubSchedules2 = async (Schedule, SubSchedule, Destination, Transit, Boat, { month, year, boat_id }) => {
  if (!month || !year || !boat_id) {
    throw new Error('Please provide month, year, and boat_id.');
  }

  try {
    // Define the first and last date of the month
    const firstDate = new Date(year, month - 1, 1);
    const lastDate = new Date(year, month, 0);

    // Fetch all schedules and sub-schedules valid within the month for the specified boat_id
    const schedules = await Schedule.findAll({
      where: {
        boat_id: boat_id,
        [Op.or]: [
          {
            validity_start: { [Op.lte]: lastDate },
            validity_end: { [Op.gte]: firstDate },
          },
        ],
      },
      include: [
        {
          model: SubSchedule,
          as: 'SubSchedules',
          where: {
            [Op.or]: [
              {
                validity_start: { [Op.lte]: lastDate },
                validity_end: { [Op.gte]: firstDate },
              },
            ],
          },
          required: false,
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
              include: {
                model: Destination,
                as: 'Destination',
                attributes: ['name'],
              },
            },
            {
              model: Transit,
              as: 'TransitTo',
              include: {
                model: Destination,
                as: 'Destination',
                attributes: ['name'],
              },
            },
            {
              model: Transit,
              as: 'Transit1',
              include: {
                model: Destination,
                as: 'Destination',
                attributes: ['name'],
              },
            },
            {
              model: Transit,
              as: 'Transit2',
              include: {
                model: Destination,
                as: 'Destination',
                attributes: ['name'],
              },
            },
            {
              model: Transit,
              as: 'Transit3',
              include: {
                model: Destination,
                as: 'Destination',
                attributes: ['name'],
              },
            },
            {
              model: Transit,
              as: 'Transit4',
              include: {
                model: Destination,
                as: 'Destination',
                attributes: ['name'],
              },
            },
          ],
        },
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
          model: Boat,
          as: 'Boat',
          attributes: ['boat_name', 'capacity'],
        },
      ],
    });

    return schedules;
  } catch (error) {
    console.error('Error fetching schedules with sub-schedules:', error);
    throw new Error('Failed to fetch schedules for the specified month and boat.');
  }
};

module.exports = {
  getSchedulesWithSubSchedules2,
};


