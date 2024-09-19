// utils/formatUtils.js

const { id } = require("date-fns/locale");

/**
 * Format schedules with transit data, destination information, and seat availability.
 * @param {Array} schedules - The array of schedule objects.
 * @returns {Array} - Formatted schedules.
 */
const formatSchedules = (schedules) => {
  console.log("schedules data ini cuk:", schedules);
  return schedules.map(schedule => ({
    id: schedule.id,
    from: schedule.FromDestination?.name || "N/A",
    to: schedule.ToDestination?.name || "N/A",
    transits: schedule.Transits.map(transit => ({
      destination: transit.Destination?.name || "N/A",
      departure_time: transit.departure_time,
      arrival_time: transit.arrival_time,
      journey_time: transit.journey_time
    })),
    route_image: schedule.route_image || "N/A",
    // ADD TIME
    departure_time: schedule.departure_time || "N/A",
    arrival_time: schedule.arrival_time || "N/A",
    journey_time: schedule.journey_time || "N/A",
    check_in_time: schedule.check_in_time || "N/A",
    low_season_price: schedule.low_season_price || "N/A",
    high_season_price: schedule.high_season_price || "N/A",
    peak_season_price: schedule.peak_season_price || "N/A",
    seatAvailability: {
      id: schedule.dataValues.seatAvailability?.id || "N/A",
      available_seats: schedule.dataValues.seatAvailability?.available_seats || "N/A",
      date: schedule.dataValues.seatAvailability?.date 
        ? new Date(schedule.dataValues.seatAvailability.date).toLocaleDateString()  // Format date to readable format
        : "N/A",
    },
  }));
};

/**
 * Format subschedules with transit data, destination information, and seat availability.
 * @param {Array} subSchedules - The array of subschedule objects.
 * @returns {Array} - Formatted subschedules.
 */
const formatSubSchedules = (subSchedules) => {
  return subSchedules.map(subSchedule => {
    // Check if there's a TransitFrom or TransitTo
    const hasTransitFrom = !!subSchedule.TransitFrom;
    const hasTransitTo = !!subSchedule.TransitTo;

    // Get departure_time and check_in_time from TransitFrom or fallback to Schedule
    const departure_time = hasTransitFrom
      ? subSchedule.TransitFrom.departure_time
      : subSchedule.Schedule?.departure_time || "N/A";

    const check_in_time = hasTransitFrom
      ? subSchedule.TransitFrom.check_in_time
      : subSchedule.Schedule?.check_in_time || "N/A";

    // Log to show which source is used for departure and check-in times
    if (hasTransitFrom) {
      console.log(`SubSchedule ID: ${subSchedule.id} - Using TransitFrom for departure_time and check_in_time`);
    } else {
      console.log(`SubSchedule ID: ${subSchedule.id} - Using Schedule for departure_time and check_in_time`);
    }

    // Get arrival_time and journey_time from TransitTo or fallback to Schedule
    const arrival_time = hasTransitTo
      ? subSchedule.TransitTo.arrival_time
      : subSchedule.Schedule?.arrival_time || "N/A";

    const journey_time = hasTransitTo
      ? subSchedule.TransitTo.journey_time
      : subSchedule.Schedule?.journey_time || "N/A";

    // Log to show which source is used for arrival and journey times
    if (hasTransitTo) {
      console.log(`SubSchedule ID: ${subSchedule.id} - Using TransitTo for arrival_time and journey_time`);
    } else {
      console.log(`SubSchedule ID: ${subSchedule.id} - Using Schedule for arrival_time and journey_time`);
    }

    return {
      id: subSchedule.id,
      schedule_id: subSchedule.Schedule?.id || "N/A",  // Check if Schedule exists before accessing id
      from: subSchedule.DestinationFrom?.name || subSchedule.TransitFrom?.Destination?.name || "N/A",
      to: subSchedule.DestinationTo?.name || subSchedule.TransitTo?.Destination?.name || "N/A",
      transits: [
        subSchedule.Transit1 ? {
          id: subSchedule.Transit1.id,
          destination: subSchedule.Transit1.Destination?.name || "N/A",
          departure_time: subSchedule.Transit1.departure_time,
          arrival_time: subSchedule.Transit1.arrival_time,
          journey_time: subSchedule.Transit1.journey_time
        } : null,
        subSchedule.Transit2 ? {
          id: subSchedule.Transit2.id,
          destination: subSchedule.Transit2.Destination?.name || "N/A",
          departure_time: subSchedule.Transit2.departure_time,
          arrival_time: subSchedule.Transit2.arrival_time,
          journey_time: subSchedule.Transit2.journey_time
        } : null,
        subSchedule.Transit3 ? {
          id: subSchedule.Transit3.id,
          destination: subSchedule.Transit3.Destination?.name || "N/A",
          departure_time: subSchedule.Transit3.departure_time,
          arrival_time: subSchedule.Transit3.arrival_time,
          journey_time: subSchedule.Transit3.journey_time
        } : null,
        subSchedule.Transit4 ? {
          id: subSchedule.Transit4.id,
          destination: subSchedule.Transit4.Destination?.name || "N/A",
          departure_time: subSchedule.Transit4.departure_time,
          arrival_time: subSchedule.Transit4.arrival_time,
          journey_time: subSchedule.Transit4.journey_time
        } : null,
      ].filter(Boolean),
      route_image: subSchedule.route_image || "N/A",
      low_season_price: subSchedule.low_season_price || "N/A",
      high_season_price: subSchedule.high_season_price || "N/A",
      peak_season_price: subSchedule.peak_season_price || "N/A",
      departure_time,  // Use the computed departure_time
      check_in_time,  // Use the computed check_in_time
      arrival_time,  // Use the computed arrival_time
      journey_time,  // Use the computed journey_time
      seatAvailability: {
        id: subSchedule.dataValues.seatAvailability?.id || "N/A",
        available_seats: subSchedule.dataValues.seatAvailability?.available_seats || "N/A",
        date: subSchedule.dataValues.seatAvailability?.date 
          ? new Date(subSchedule.dataValues.seatAvailability.date).toLocaleDateString()  // Format date to readable format
          : "N/A",
      },
    };
  });
};


module.exports = {
  formatSchedules,
  formatSubSchedules,
};
