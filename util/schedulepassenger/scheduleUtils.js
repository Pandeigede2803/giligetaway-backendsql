const { sequelize, Booking, SeatAvailability, Destination, SubSchedule, Transport, Schedule, Passenger, Transit, TransportBooking, AgentMetrics, Agent, BookingSeatAvailability, Boat } = require('../../models');
const { Op } = require('sequelize');

const getSchedulesWithSubSchedules2 = async (
  Schedule,
  SubSchedule,
  Destination,
  Transit,
  Boat,
  { month, year, boat_id }
) => {
  if (!month || !year) {
    throw new Error("Please provide month and year.");
  }

  // Konversi boat_id menjadi angka (jika dikirim sebagai string dari req.query)
  boat_id = parseInt(boat_id, 10);

  console.log("BOAT ID RECEIVED:", boat_id);

  try {
    // Define the first and last date of the month
    const firstDate = new Date(year, month - 1, 1);
    const lastDate = new Date(year, month, 0);

    // Jika boat_id = 0, maka jangan filter berdasarkan boat_id
    const boatFilter = boat_id === 0 ? {} : { boat_id };

    console.log("Fetching schedules for:", { month, year, boat_id, boatFilter });

    // Fetch all schedules and sub-schedules valid within the month
    const schedules = await Schedule.findAll({
      where: {
        availability: true,
        ...boatFilter, // Gunakan filter dinamis
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
          as: "SubSchedules",
          where: {
            availability: true,
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
              as: "DestinationFrom",
              attributes: ["name"],
            },
            {
              model: Destination,
              as: "DestinationTo",
              attributes: ["name"],
            },
            {
              model: Transit,
              as: "TransitFrom",
              include: {
                model: Destination,
                as: "Destination",
                attributes: ["name"],
              },
            },
            {
              model: Transit,
              as: "TransitTo",
              include: {
                model: Destination,
                as: "Destination",
                attributes: ["name"],
              },
            },
          ],
        },
        {
          model: Destination,
          as: "FromDestination",
          attributes: ["name"],
        },
        {
          model: Destination,
          as: "ToDestination",
          attributes: ["name"],
        },
        {
          model: Boat,
          as: "Boat",
          attributes: ["boat_name", "capacity"],
        },
      ],
    });

    console.log("Schedules Found:", schedules.length);

    return schedules;
  } catch (error) {
    console.error("Error fetching schedules with sub-schedules:", error);
    throw new Error("Failed to fetch schedules for the specified month and boat.");
  }
};


module.exports = {
  getSchedulesWithSubSchedules2,
};


