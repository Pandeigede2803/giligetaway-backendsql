const { Op } = require('sequelize');
const {
  Schedule,
  SubSchedule,
  User,
  Boat,
  Transit,
  SeatAvailability,
  Destination,
  Passenger,
  Booking,
  sequelize,
} = require("../models");
const { uploadImageToImageKit } = require("../middleware/upload");
const { processBookedSeats } = require("../util/seatUtils");
const { getDay } = require('date-fns');



/**
 * Utils untuk memformat route dan transit menjadi format yang mudah dipahami
 */

/**
 * Format route dengan timeline yang jelas
 * @param {Object} schedule - Schedule atau SubSchedule object
 * @returns {Object} Formatted route object
 */
const formatRouteTimeline = (schedule) => {
  const isSubSchedule = schedule.subschedule_id || schedule.DestinationFrom;
  
  // Ambil data dari schedule atau subschedule
  const fromDestination = isSubSchedule ? 
    schedule.DestinationFrom?.name : 
    schedule.FromDestination?.name;
    
  const toDestination = isSubSchedule ? 
    schedule.DestinationTo?.name : 
    schedule.ToDestination?.name;
    
  const departureTime = schedule.departure_time || schedule.Schedule?.departure_time;
  const arrivalTime = schedule.arrival_time || schedule.Schedule?.arrival_time;
  const transits = schedule.transits || schedule.Transits || [];

  // Build route timeline
  const routeTimeline = [];
  
  // 1. Starting point (FROM)
  routeTimeline.push({
    type: 'departure',
    location: fromDestination,
    time: departureTime,
    action: 'Depart from'
  });

  // 2. Transit points
  if (transits && transits.length > 0) {
    transits.forEach((transit, index) => {
      const transitDestination = transit.Destination?.name || transit.destination;
      
      // Arrival at transit
      routeTimeline.push({
        type: 'transit_arrival',
        location: transitDestination,
        time: transit.arrival_time,
        action: 'Arrive at',
        transit_number: index + 1
      });
      
      // Departure from transit (if not the last transit)
      if (index < transits.length - 1 || toDestination !== transitDestination) {
        routeTimeline.push({
          type: 'transit_departure',
          location: transitDestination,
          time: transit.departure_time,
          action: 'Depart from',
          transit_number: index + 1,
          journey_time_to_next: transit.journey_time
        });
      }
    });
  }

  // 3. Final destination (TO) - only if different from last transit
  const lastTransit = transits[transits.length - 1];
  const lastTransitDestination = lastTransit?.Destination?.name || lastTransit?.destination;
  
  if (!lastTransit || toDestination !== lastTransitDestination) {
    routeTimeline.push({
      type: 'arrival',
      location: toDestination,
      time: arrivalTime,
      action: 'Arrive at'
    });
  }

  return {
    route_summary: `${fromDestination} → ${toDestination}`,
    total_journey_time: schedule.journey_time || schedule.Schedule?.journey_time,
    timeline: routeTimeline,
    stops_count: transits.length + 2, // from + transits + to
    route_type: transits.length > 0 ? 'multi_stop' : 'direct'
  };
};

/**
 * Format route menjadi string yang mudah dibaca
 * @param {Object} schedule - Schedule atau SubSchedule object
 * @returns {String} Route string
 */
const formatRouteString = (schedule) => {
  const timeline = formatRouteTimeline(schedule);
  
  let routeString = '';
  
  timeline.timeline.forEach((stop, index) => {
    if (stop.type === 'departure') {
      routeString += `${stop.time} ${stop.location}`;
    } else if (stop.type === 'transit_arrival') {
      routeString += ` → ${stop.time} ${stop.location}`;
    } else if (stop.type === 'transit_departure') {
      routeString += ` (${stop.time})`;
    } else if (stop.type === 'arrival') {
      routeString += ` → ${stop.time} ${stop.location}`;
    }
  });
  
  return routeString;
};

/**
 * Format route menjadi array step-by-step
 * @param {Object} schedule - Schedule atau SubSchedule object
 * @returns {Array} Array of route steps
 */
const formatRouteSteps = (schedule) => {
  const timeline = formatRouteTimeline(schedule);
  const steps = [];
  
  for (let i = 0; i < timeline.timeline.length; i++) {
    const current = timeline.timeline[i];
    const next = timeline.timeline[i + 1];
    
    if (current.type === 'departure') {
      steps.push({
        step: steps.length + 1,
        from: current.location,
        departure_time: current.time,
        to: next?.location,
        arrival_time: next?.time,
        type: next?.type === 'transit_arrival' ? 'to_transit' : 'to_destination'
      });
    } else if (current.type === 'transit_departure') {
      steps.push({
        step: steps.length + 1,
        from: current.location,
        departure_time: current.time,
        to: next?.location,
        arrival_time: next?.time,
        type: next?.type === 'transit_arrival' ? 'transit_to_transit' : 'transit_to_destination'
      });
    }
  }
  
  return steps;
};

/**
 * Format schedule dengan route yang mudah dipahami
 * @param {Object} schedule - Schedule atau SubSchedule object
 * @returns {Object} Formatted schedule dengan route yang clear
 */
const formatScheduleWithClearRoute = (schedule) => {
  const isSubSchedule = schedule.subschedule_id || schedule.DestinationFrom;
  
  const routeTimeline = formatRouteTimeline(schedule);
  const routeString = formatRouteString(schedule);
  const routeSteps = formatRouteSteps(schedule);
  
  return {
    // Basic info
    id: schedule.id,
    schedule_id: isSubSchedule ? schedule.schedule_id : schedule.id,
    subschedule_id: isSubSchedule ? schedule.id : null,
    type: isSubSchedule ? 'connecting' : 'direct',
    
    // Route info (NEW - Easy to understand)
    route: {
      summary: routeTimeline.route_summary,
      timeline: routeTimeline.timeline,
      steps: routeSteps,
      description: routeString,
      total_journey_time: routeTimeline.total_journey_time,
      stops_count: routeTimeline.stops_count,
      type: routeTimeline.route_type
    },
    
    // Timing
    departure_time: schedule.departure_time || schedule.Schedule?.departure_time,
    arrival_time: schedule.arrival_time || schedule.Schedule?.arrival_time,
    check_in_time: schedule.check_in_time || schedule.Schedule?.check_in_time,
    
    // Other info
    price: schedule.price,
    boat_name: schedule.boat_name,
    route_image: schedule.route_image,
    seatAvailability: schedule.seatAvailability
  };
};


/**
 * Query untuk mendapatkan schedules berdasarkan parameter - OPTIMIZED
 */
const querySchedules = async (from, to, selectedDate, selectedDayOfWeek) => {
  return await Schedule.findAll({
    where: {
      destination_from_id: from,
      destination_to_id: to,
      availability: 1,
      validity_start: { [Op.lte]: selectedDate },
      validity_end: { [Op.gte]: selectedDate },
      [Op.and]: sequelize.literal(
        `(Schedule.days_of_week & ${1 << selectedDayOfWeek}) != 0`
      ),
    },
    include: [
      {
        model: Destination,
        as: "FromDestination",
        attributes: ["id", "name", "port_map_url", "image_url"],
      },
      {
        model: SeatAvailability,
        as: "SeatAvailabilities",
        where: { date: selectedDate }, // TAMBAH: Filter by date
        required: false, // PENTING: Jangan required true agar tetap return schedule walau belum ada seat availability
        attributes: ["id", "available_seats", "availability", "boost"]
      },
      {
        model: Destination,
        as: "ToDestination",
        attributes: ["id", "name", "port_map_url", "image_url"],
      },
      {
        model: Boat,
        as: "Boat",
        attributes: [
          "id", 
          "capacity", 
          "boat_name", 
          "boat_image",
          "inside_seats",
          "outside_seats", 
          "rooftop_seats"
        ],
      },
      {
        model: Transit,
        attributes: [
          "id",
          "destination_id",
          "departure_time",
          "arrival_time",
          "journey_time",
          "check_in_time",
        ],
        include: [
          {
            model: Destination,
            as: "Destination",
            attributes: ["id", "name"],
          },
        ],
      },
    ],
    attributes: [
      "id",
      "route_image",
      "low_season_price",
      "high_season_price",
      "peak_season_price",
      "departure_time",
      "check_in_time",
      "arrival_time",
      "journey_time",
    ],
  });
};

/**
 * Query untuk mendapatkan subSchedules berdasarkan parameter - OPTIMIZED
 */
const querySubSchedules = async (from, to, selectedDate, selectedDayOfWeek) => {
  return await SubSchedule.findAll({
    where: {
      availability: true,
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
    },
    include: [
      {
        model: Destination,
        as: "DestinationFrom",
        attributes: ["id", "name", "port_map_url", "image_url"],
      },
      {
        model: SeatAvailability,
        as: "SeatAvailabilities",
        where: { date: selectedDate }, // TAMBAH: Filter by date
        required: false, // PENTING: Jangan required true
        attributes: ["id", "available_seats", "availability", "boost"]
      },
      {
        model: Destination,
        as: "DestinationTo",
        attributes: ["id", "name", "port_map_url", "image_url"],
      },
      {
        model: Transit,
        as: "TransitFrom",
        attributes: [
          "id",
          "destination_id",
          "departure_time",
          "arrival_time",
          "journey_time",
          "check_in_time",
        ],
        include: {
          model: Destination,
          as: "Destination",
          attributes: ["id", "name", "port_map_url", "image_url"],
        },
      },
      {
        model: Transit,
        as: "TransitTo",
        attributes: [
          "id",
          "destination_id",
          "departure_time",
          "arrival_time",
          "journey_time",
          "check_in_time",
        ],
        include: {
          model: Destination,
          as: "Destination",
          attributes: ["id", "name", "port_map_url", "image_url"],
        },
      },
      {
        model: Transit,
        as: "Transit1",
        attributes: [
          "id",
          "destination_id",
          "departure_time",
          "arrival_time",
          "journey_time",
          "check_in_time",
        ],
        include: {
          model: Destination,
          as: "Destination",
          attributes: ["id", "name", "port_map_url", "image_url"],
        },
      },
      {
        model: Transit,
        as: "Transit2",
        attributes: [
          "id",
          "destination_id",
          "departure_time",
          "arrival_time",
          "journey_time",
          "check_in_time",
        ],
        include: {
          model: Destination,
          as: "Destination",
          attributes: ["id", "name", "port_map_url", "image_url"],
        },
      },
      {
        model: Transit,
        as: "Transit3",
        attributes: [
          "id",
          "destination_id",
          "departure_time",
          "arrival_time",
          "journey_time",
          "check_in_time",
        ],
        include: {
          model: Destination,
          as: "Destination",
          attributes: ["id", "name", "port_map_url", "image_url"],
        },
      },
      {
        model: Transit,
        as: "Transit4",
        attributes: [
          "id",
          "destination_id",
          "departure_time",
          "arrival_time",
          "journey_time",
          "check_in_time",
        ],
        include: {
          model: Destination,
          as: "Destination",
          attributes: ["id", "name", "port_map_url", "image_url"],
        },
      },
      {
        model: Schedule,
        as: "Schedule",
        attributes: [
          "id",
          "departure_time",
          "check_in_time",
          "arrival_time",
          "journey_time",
        ],
        include: [
          {
            model: Boat,
            as: "Boat",
            attributes: [
              "id", 
              "capacity", 
              "boat_name", 
              "boat_image",
              "inside_seats",
              "outside_seats", 
              "rooftop_seats"
            ],
          },
        ],
      },
    ],
  });
};

/**
 * BARU: Fungsi untuk membuat SeatAvailability yang missing secara batch
 */
const createMissingSeatAvailabilities = async (schedules, subSchedules, selectedDate) => {
  const toCreate = [];
  
  // Check schedules yang belum punya SeatAvailability
  schedules.forEach(schedule => {
    if (!schedule.SeatAvailabilities || schedule.SeatAvailabilities.length === 0) {
      toCreate.push({
        schedule_id: schedule.id,
        subschedule_id: null,
        date: selectedDate,
        available_seats: schedule.Boat?.capacity || 0,
        availability: true,
        boost: false
      });
    }
  });

  // Check subSchedules yang belum punya SeatAvailability
  subSchedules.forEach(subSchedule => {
    if (!subSchedule.SeatAvailabilities || subSchedule.SeatAvailabilities.length === 0) {
      toCreate.push({
        schedule_id: null,
        subschedule_id: subSchedule.id,
        date: selectedDate,
        available_seats: subSchedule.Schedule?.Boat?.capacity || 0,
        availability: true,
        boost: false
      });
    }
  });

  // Bulk create jika ada yang perlu dibuat
  if (toCreate.length > 0) {
    const newSeatAvailabilities = await SeatAvailability.bulkCreate(toCreate, {
      returning: true
    });

    // Map kembali ke schedules dan subSchedules
    let newSeatIndex = 0;
    schedules.forEach(schedule => {
      if (!schedule.SeatAvailabilities || schedule.SeatAvailabilities.length === 0) {
        schedule.SeatAvailabilities = [newSeatAvailabilities[newSeatIndex]];
        newSeatIndex++;
      }
    });

    subSchedules.forEach(subSchedule => {
      if (!subSchedule.SeatAvailabilities || subSchedule.SeatAvailabilities.length === 0) {
        subSchedule.SeatAvailabilities = [newSeatAvailabilities[newSeatIndex]];
        newSeatIndex++;
      }
    });
  }
};

/**
 * OPTIMIZED: Process seat availability data dari relasi yang sudah ada
 */
const processSeatAvailabilityData = (schedules, subSchedules, selectedDate) => {
  const seatAvailabilityIds = [];
  const seatAvailabilityData = new Map();

  // Process schedules
  schedules.forEach(schedule => {
    const seatAvailability = schedule.SeatAvailabilities?.[0];
    if (seatAvailability) {
      seatAvailabilityIds.push(seatAvailability.id);
      
      seatAvailabilityData.set(seatAvailability.id, {
        boatData: schedule.Boat,
        boost: seatAvailability.boost,
        type: 'schedule'
      });

      schedule.dataValues.seatAvailability = {
        id: seatAvailability.id,
        available_seats: seatAvailability.available_seats,
        date: selectedDate,
        availability: seatAvailability.availability
      };
    }
  });

  // Process subSchedules
  subSchedules.forEach(subSchedule => {
    const seatAvailability = subSchedule.SeatAvailabilities?.[0];
    if (seatAvailability) {
      seatAvailabilityIds.push(seatAvailability.id);
      
      seatAvailabilityData.set(seatAvailability.id, {
        boatData: subSchedule.Schedule?.Boat,
        boost: seatAvailability.boost,
        type: 'subSchedule'
      });

      subSchedule.dataValues.seatAvailability = {
        id: seatAvailability.id,
        available_seats: seatAvailability.available_seats,
        date: selectedDate,
        availability: seatAvailability.availability
      };
    }
  });

  return { seatAvailabilityIds, seatAvailabilityData };
};

/**
 * OPTIMIZED: Query booked seats dengan raw SQL - Updated untuk BookingSeatAvailability junction table
 */
const getBookedSeatsOptimized = async (seatAvailabilityIds) => {
  if (seatAvailabilityIds.length === 0) {
    return {};
  }

  const bookedSeats = await sequelize.query(`
    SELECT 
      bsa.seat_availability_id,
      p.seat_number
    FROM BookingSeatAvailability bsa
    JOIN Bookings b ON bsa.booking_id = b.id
    JOIN Passengers p ON p.booking_id = b.id
    WHERE bsa.seat_availability_id IN (:seatAvailabilityIds)
      AND b.payment_status IN ('paid', 'invoiced', 'pending', 'unpaid')
      AND p.seat_number IS NOT NULL
  `, {
    replacements: { seatAvailabilityIds },
    type: sequelize.QueryTypes.SELECT
  });

  // Group by seat_availability_id
  const bookedSeatsByAvailabilityId = {};
  
  seatAvailabilityIds.forEach(id => {
    bookedSeatsByAvailabilityId[id] = [];
  });

  bookedSeats.forEach(({ seat_availability_id, seat_number }) => {
    if (!bookedSeatsByAvailabilityId[seat_availability_id]) {
      bookedSeatsByAvailabilityId[seat_availability_id] = [];
    }
    bookedSeatsByAvailabilityId[seat_availability_id].push(seat_number);
  });

  return bookedSeatsByAvailabilityId;
};

/**
 * Filter schedules berdasarkan availability dan available_seats
 */
const filterAvailableSchedules = (schedules) => {
  return schedules.filter(schedule => 
    schedule.dataValues.seatAvailability && 
    schedule.dataValues.seatAvailability.available_seats > 0 &&
    schedule.dataValues.seatAvailability.availability === true
  );
};

/**
 * Filter subSchedules berdasarkan availability dan available_seats
 */
const filterAvailableSubSchedules = (subSchedules) => {
  return subSchedules.filter(subSchedule => 
    subSchedule.dataValues.seatAvailability && 
    subSchedule.dataValues.seatAvailability.available_seats > 0 &&
    subSchedule.dataValues.seatAvailability.availability === true
  );
};

/**
 * OPTIMIZED: Fungsi utama untuk mendapatkan schedules dan subSchedules
 */
const getSchedulesAndSubSchedules = async (from, to, date) => {
  const selectedDate = new Date(date);
  const selectedDayOfWeek = getDay(selectedDate);

  // Query schedules dan subSchedules (sudah include SeatAvailability)
  const schedules = await querySchedules(from, to, selectedDate, selectedDayOfWeek);
  const subSchedules = await querySubSchedules(from, to, selectedDate, selectedDayOfWeek);

  // Buat SeatAvailability yang missing secara batch
  await createMissingSeatAvailabilities(schedules, subSchedules, selectedDate);

  // Process seat availability data
  const { seatAvailabilityIds, seatAvailabilityData } = processSeatAvailabilityData(
    schedules, 
    subSchedules, 
    selectedDate
  );

  // Get booked seats dengan query optimized
  const bookedSeatsByAvailabilityId = await getBookedSeatsOptimized(seatAvailabilityIds);

  // Process booked seats untuk setiap availability
  const processedBookedSeatsByAvailabilityId = {};
  
  for (const seatAvailId of seatAvailabilityIds) {
    const bookedSeats = bookedSeatsByAvailabilityId[seatAvailId] || [];
    const seatData = seatAvailabilityData.get(seatAvailId);
    
    if (seatData) {
      const processedSeats = processBookedSeats(
        new Set(bookedSeats),
        seatData.boost,
        seatData.boatData
      );
      processedBookedSeatsByAvailabilityId[seatAvailId] = processedSeats;
    } else {
      processedBookedSeatsByAvailabilityId[seatAvailId] = bookedSeats;
    }
  }

  // Tambahkan booked seat numbers ke schedule data
  schedules.forEach(schedule => {
    if (schedule.dataValues.seatAvailability) {
      const seatAvailId = schedule.dataValues.seatAvailability.id;
      schedule.dataValues.seatAvailability.bookedSeatNumbers = 
        processedBookedSeatsByAvailabilityId[seatAvailId] || [];
    }
  });

  subSchedules.forEach(subSchedule => {
    if (subSchedule.dataValues.seatAvailability) {
      const seatAvailId = subSchedule.dataValues.seatAvailability.id;
      subSchedule.dataValues.seatAvailability.bookedSeatNumbers = 
        processedBookedSeatsByAvailabilityId[seatAvailId] || [];
    }
  });

  return {
    schedules,
    subSchedules,
    selectedDate,
    selectedDayOfWeek
  };
};

module.exports = {
  querySchedules,
  querySubSchedules,
  filterAvailableSchedules,
  filterAvailableSubSchedules,
  getSchedulesAndSubSchedules,
  // Export fungsi baru untuk digunakan di tempat lain jika perlu
  createMissingSeatAvailabilities,
  processSeatAvailabilityData,
  getBookedSeatsOptimized,
    formatRouteTimeline,
  formatRouteString,
  formatRouteSteps,
  formatScheduleWithClearRoute
};