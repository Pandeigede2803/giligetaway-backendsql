// utils/formatUtils.js

const { sub } = require("date-fns");
const { id } = require("date-fns/locale");

/**
 * Format schedules with transit data, destination information, and seat availability.
 * @param {Array} schedules - The array of schedule objects.
 * @returns {Array} - Formatted schedules.
 */
// Utility function to determine the season based on the month
const getSeasonPrice = (
  date,
  lowSeasonPrice,
  highSeasonPrice,
  peakSeasonPrice
) => {
  const month = new Date(date).getMonth() + 1; // getMonth() is zero-based, so adding 1

  // Get season months from environment variables
  const lowSeasonMonths = process.env.LOW_SEASON_MONTHS.split(",").map(Number);
  const highSeasonMonths =
    process.env.HIGH_SEASON_MONTHS.split(",").map(Number);
  const peakSeasonMonths =
    process.env.PEAK_SEASON_MONTHS.split(",").map(Number);

  // Check which season the current month falls into
  if (lowSeasonMonths.includes(month)) {
    return lowSeasonPrice || "N/A";
  } else if (highSeasonMonths.includes(month)) {
    return highSeasonPrice || "N/A";
  } else if (peakSeasonMonths.includes(month)) {
    return peakSeasonPrice || "N/A";
  } else {
    return "N/A";
  }
};

/**
 * Format schedules with transit data, destination information, and seat availability.
 * @param {Array} schedules - The array of schedule objects.
 * @param {String} selectedDate - The selected date to determine season pricing.
 * @returns {Array} - Formatted schedules.
 */
const formatSchedules = (schedules, selectedDate) => {
  // console.log("scehdules:", JSON.stringify(schedules, null, 2));
  return schedules.map((schedule) => ({
    id: schedule.id,
    schedule_id:schedule.id || "N/A",
    subschedule_id: schedule.sub_schedule_id || "N/A",
    from: schedule.FromDestination?.name || "N/A",
    to: schedule.ToDestination?.name || "N/A",
    transits: schedule.Transits.map((transit) => ({
      destination: transit.Destination?.name || "N/A",
      departure_time: transit.departure_time,
      arrival_time: transit.arrival_time,
      journey_time: transit.journey_time,
    })),
    route_image: schedule.route_image || "N/A",
   
    // ADD TIME
    departure_time: schedule.departure_time || "N/A",
    arrival_time: schedule.arrival_time || "N/A",
    journey_time: schedule.journey_time || "N/A",
    check_in_time: schedule.check_in_time || "N/A",
    price: getSeasonPrice(
      selectedDate,
      schedule.low_season_price,
      schedule.high_season_price,
      schedule.peak_season_price
    ), // Get the correct price based on the season
    seatAvailability: {
      id: schedule.dataValues.seatAvailability?.id || "N/A",
      // add schedule_id and subschedule_id to seatAvailability
      schedule_id: schedule.dataValues.seatAvailability?.schedule_id || "N/A",
      subschedule_id: schedule.dataValues.seatAvailability?.subschedule_id || "N/A",
      availability:
        schedule.dataValues.seatAvailability?.availability || "N/A",
      available_seats:
        schedule.dataValues.seatAvailability?.available_seats ,
boost: typeof schedule.dataValues.seatAvailability?.boost === 'boolean'
  ? schedule.dataValues.seatAvailability.boost
  : "N/A",
      date: schedule.dataValues.seatAvailability?.date
        ? new Date(
            schedule.dataValues.seatAvailability.date
          ).toLocaleDateString() // Format date to readable format
        : "N/A",

     
    },
     // Add boat_name to the schedule output
     boat_name: schedule.Boat?.boat_name || "N/A",
  }));
};

/**
 * Format subschedules with transit data, destination information, and seat availability.
 * @param {Array} subSchedules - The array of subschedule objects.
 * @param {String} selectedDate - The selected date to determine season pricing.
 * @returns {Array} - Formatted subschedules.
 */
const formatSubSchedules = (subSchedules, selectedDate) => {
  
  // console.log("😹SubSchedules:", JSON.stringify(subSchedules, null, 2));
  return subSchedules.map((subSchedule) => {
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

    // Get arrival_time and journey_time from TransitTo or fallback to Schedule
    const arrival_time = hasTransitTo
      ? subSchedule.TransitTo.arrival_time
      : subSchedule.Schedule?.arrival_time || "N/A";

    const journey_time = hasTransitTo
      ? subSchedule.TransitTo.journey_time
      : subSchedule.Schedule?.journey_time || "N/A";

    return {
      id: subSchedule.id,
    
      schedule_id: subSchedule.Schedule?.id || "N/A",
      subschedule_id: subSchedule.id || "N/A",
      from:
        subSchedule.DestinationFrom?.name ||
        subSchedule.TransitFrom?.Destination?.name ||
        "N/A",
      to:
        subSchedule.DestinationTo?.name ||
        subSchedule.TransitTo?.Destination?.name ||
        "N/A",
      transits: [
        subSchedule.Transit1
          ? {
              id: subSchedule.Transit1.id,
              destination: subSchedule.Transit1.Destination?.name || "N/A",
              departure_time: subSchedule.Transit1.departure_time,
              arrival_time: subSchedule.Transit1.arrival_time,
              journey_time: subSchedule.Transit1.journey_time,
            }
          : null,
        subSchedule.Transit2
          ? {
              id: subSchedule.Transit2.id,
              destination: subSchedule.Transit2.Destination?.name || "N/A",
              departure_time: subSchedule.Transit2.departure_time,
              arrival_time: subSchedule.Transit2.arrival_time,
              journey_time: subSchedule.Transit2.journey_time,
            }
          : null,
        subSchedule.Transit3
          ? {
              id: subSchedule.Transit3.id,
              destination: subSchedule.Transit3.Destination?.name || "N/A",
              departure_time: subSchedule.Transit3.departure_time,
              arrival_time: subSchedule.Transit3.arrival_time,
              journey_time: subSchedule.Transit3.journey_time,
            }
          : null,
        subSchedule.Transit4
          ? {
              id: subSchedule.Transit4.id,
              destination: subSchedule.Transit4.Destination?.name || "N/A",
              departure_time: subSchedule.Transit4.departure_time,
              arrival_time: subSchedule.Transit4.arrival_time,
              journey_time: subSchedule.Transit4.journey_time,
            }
          : null,
      ].filter(Boolean),
      route_image: subSchedule.route_image || "N/A",
      price: getSeasonPrice(
        selectedDate,
        subSchedule.low_season_price,
        subSchedule.high_season_price,
        subSchedule.peak_season_price
      ), // Get the correct price based on the season
      departure_time, // Use the computed departure_time
      check_in_time, // Use the computed check_in_time
      arrival_time, // Use the computed arrival_time
      journey_time, // Use the computed journey_time
      seatAvailability: {
        id: subSchedule.dataValues.seatAvailability?.id || "N/A",
        schedule_id: subSchedule.dataValues.seatAvailability?.schedule_id || "N/A",
        subschedule_id: subSchedule.dataValues.seatAvailability?.subschedule_id || "N/A",
        available_seats:
          subSchedule.dataValues.seatAvailability?.available_seats ,
        availability:
          subSchedule.dataValues.seatAvailability?.availability || "N/A",
        boost: typeof subSchedule.dataValues.seatAvailability?.boost === 'boolean'
  ? subSchedule.dataValues.seatAvailability.boost
  : "N/A",
        date: subSchedule.dataValues.seatAvailability?.date
          ? new Date(
              subSchedule.dataValues.seatAvailability.date
            ).toLocaleDateString() // Format date to readable format
          : "N/A",
      },
      // Add boat_name to the subschedule output
      boat_name: subSchedule.Schedule?.Boat?.boat_name || "N/A",
    };
  });
};

module.exports = {
  formatSchedules,
  formatSubSchedules,
};
