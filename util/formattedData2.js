const { sequelize, Booking, SeatAvailability,Destination,Transport, Schedule,SubSchedule,Transaction, Passenger,Transit, TransportBooking, AgentMetrics, Agent, BookingSeatAvailability, Boat } = require('../models');

const getCommonInclude = () => [
    {
      model: Destination,
      as: "FromDestination",
      attributes: ["id", "name"],
    },
    {
      model: Destination,
      as: "ToDestination",
      attributes: ["id", "name"],
    },
    {
      model: Boat,
      as: "Boat",
      attributes: ["id", "capacity", "boat_name"],
    },
    {
      model: Transit,
      attributes: [
        "id",
        "destination_id",
        "departure_time",
        "arrival_time",
        "journey_time",
      ],
      include: [
        {
          model: Destination,
          as: "Destination",
          attributes: ["id", "name"],
        },
      ],
    },
  ];
  const getScheduleAttributes = () => [
    "id",
    "route_image",
    "low_season_price",
    "high_season_price",
    "peak_season_price",
    "departure_time",
    "check_in_time",
    "arrival_time",
    "journey_time",
  ];
  const getSubScheduleWhereConditions = (from, to, selectedDate, selectedDayOfWeek) => ({
    [Op.and]: [
      {
        [Op.or]: [
          { destination_from_schedule_id: from },
          { "$TransitFrom.destination_id$": from },
        ],
      },
      {
        [Op.or]: [
          { destination_to_schedule_id: to },
          { "$TransitTo.destination_id$": to },
        ],
      },
      {
        validity_start: { [Op.lte]: selectedDate },
        validity_end: { [Op.gte]: selectedDate },
        [Op.and]: sequelize.literal(
          `(SubSchedule.days_of_week & ${1 << selectedDayOfWeek}) != 0`
        ),
      },
    ],
    availability: true,
  });

  const getSubScheduleInclude = () => [
    {
      model: Destination,
      as: 'DestinationFrom',
      attributes: ['id', 'name'],
    },
    {
      model: Destination,
      as: 'DestinationTo',
      attributes: ['id', 'name'],
    },
    {
      model: Transit,
      as: 'TransitFrom',
      attributes: ['id', 'destination_id','check_in_time', 'departure_time', 'arrival_time', 'journey_time'],
      include: {
        model: Destination,
        as: 'Destination',
        attributes: ['id', 'name'],
      },
    },
    {
      model: Transit,
      as: 'TransitTo',
      attributes: ['id', 'destination_id', 'departure_time','check_in_time', 'arrival_time', 'journey_time'],
      include: {
        model: Destination,
        as: 'Destination',
        attributes: ['id', 'name'],
      },
    },
    // provide the transit 1 - 4
    {
      model: Transit,
      as: 'Transit1',
      attributes: ['id', 'destination_id', 'check_in_time', 'departure_time', 'arrival_time', 'journey_time'],
      where: {id: sequelize.col('transit_1')},
      required: false,
    },
    {
      model: Transit,
      as: 'Transit2',
      attributes: ['id', 'destination_id', 'check_in_time', 'departure_time', 'arrival_time', 'journey_time'],
      where: {id: sequelize.col('transit_2')},
      required: false,
    },
    {
      model: Transit,
      as: 'Transit3',
      attributes: ['id', 'destination_id', 'check_in_time', 'departure_time', 'arrival_time', 'journey_time'],
      where: {id: sequelize.col('transit_3')},
      required: false,
    },
    {
      model: Transit,
      as: 'Transit4',
      attributes: ['id', 'destination_id', 'check_in_time', 'departure_time', 'arrival_time', 'journey_time'],
      where: {id: sequelize.col('transit_4')},
      required: false,
    },
    {
      model: Schedule,
      as: 'Schedule',
      attributes: ['id', 'departure_time', 'check_in_time', 'arrival_time', 'journey_time'],
      include: [
        {
          model: Boat,
          as: 'Boat',
          attributes: ['id', 'capacity', 'boat_name'],
        },
      ],
    },
  ];

  // Additional Transits
const getAdditionalTransits = () => {
    const transits = [];
    for (let i = 1; i <= 4; i++) {
      transits.push({
        model: Transit,
        as: `Transit${i}`,
        attributes: [
          "id",
          "destination_id",
          "departure_time",
          "arrival_time",
          "journey_time",
        ],
        include: {
          model: Destination,
          as: "Destination",
          attributes: ["id", "name"],
        },
      });
    }
    return transits;
  };
  
  // Format Functions
 const formatSchedule = (schedule) => ({
    id: schedule.id,
    from: schedule.FromDestination?.name || "N/A",
    to: schedule.ToDestination?.name || "N/A",
    transits: formatTransits(schedule.Transits),
    route_image: schedule.route_image || "N/A",
    departure_time: schedule.departure_time || "N/A",
    check_in_time: schedule.check_in_time || "N/A",
    arrival_time: schedule.arrival_time || "N/A",
    journey_time: schedule.journey_time || "N/A",
    low_season_price: schedule.low_season_price || "N/A",
    high_season_price: schedule.high_season_price || "N/A",
    peak_season_price: schedule.peak_season_price || "N/A",
    boat_name: schedule.Boat?.boat_name || "N/A",
  });
  
const formatSubSchedule = (subSchedule) => ({
    id: subSchedule.id,
    schedule_id: subSchedule.Schedule?.id || "N/A",
    from: subSchedule.DestinationFrom?.name || subSchedule.TransitFrom?.Destination?.name || "N/A",
    to: subSchedule.DestinationTo?.name || subSchedule.TransitTo?.Destination?.name || "N/A",
    transits: formatSubTransits(subSchedule),
    route_image: subSchedule.route_image || "N/A",
    low_season_price: subSchedule.low_season_price || "N/A",
    high_season_price: subSchedule.high_season_price || "N/A",
    peak_season_price: subSchedule.peak_season_price || "N/A",
    departure_time: subSchedule.TransitFrom?.departure_time || subSchedule.Schedule?.departure_time || "N/A",
    check_in_time: subSchedule.TransitFrom?.check_in_time || subSchedule.Schedule?.check_in_time || "N/A",
    arrival_time: subSchedule.TransitTo?.arrival_time || subSchedule.Schedule?.arrival_time || "N/A",
    journey_time: subSchedule.TransitTo?.journey_time || subSchedule.Schedule?.journey_time || "N/A",
    boat_name: subSchedule.Schedule?.Boat?.boat_name || "N/A",
  });
  
const formatTransits = (transits) =>
    transits.map((transit) => ({
      destination: transit.Destination?.name || "N/A",
      departure_time: transit.departure_time,
      arrival_time: transit.arrival_time,
      journey_time: transit.journey_time,
    }));
  
 const formatSubTransits = (subSchedule) => [
    subSchedule.Transit1 && formatTransit(subSchedule.Transit1),
    subSchedule.Transit2 && formatTransit(subSchedule.Transit2),
    subSchedule.Transit3 && formatTransit(subSchedule.Transit3),
    subSchedule.Transit4 && formatTransit(subSchedule.Transit4),
  ].filter(Boolean);
  
const formatTransit = (transit) => ({
    id: transit.id,
    destination: transit.Destination?.name || "N/A",
    departure_time: transit.departure_time,
    arrival_time: transit.arrival_time,
    journey_time: transit.journey_time,
  });


// Export all functions using CommonJS
module.exports = {
    getCommonInclude,
    getScheduleAttributes,
    getSubScheduleWhereConditions,
    getSubScheduleInclude,
    formatSchedule,
    formatSubSchedule,
    formatTransits,
    formatSubTransits,
    formatTransit,
  };