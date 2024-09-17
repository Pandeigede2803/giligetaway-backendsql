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
  subSchedules.forEach(subSchedule => {
    console.log("SubSchedule ID:", subSchedule.id);
    console.log("SeatAvailability attached:", subSchedule.dataValues.seatAvailability);
  });

  return subSchedules.map(subSchedule => ({
    id: subSchedule.id,
    schedule_id: subSchedule.Schedule.id,
    from: subSchedule.DestinationFrom?.name || subSchedule.TransitFrom?.Destination?.name || "N/A",
    to: subSchedule.DestinationTo?.name || subSchedule.TransitTo?.Destination?.name || "N/A",
    transits: [
      // subSchedule.TransitFrom ? {
      //   destination: subSchedule.TransitFrom.Destination?.name || "N/A",
      //   departure_time: subSchedule.TransitFrom.departure_time,
      //   arrival_time: subSchedule.TransitFrom.arrival_time,
      //   journey_time: subSchedule.TransitFrom.journey_time
      // } : null,
      // subSchedule.TransitTo ? {
      //   destination: subSchedule.TransitTo.Destination?.name || "N/A",
      //   departure_time: subSchedule.TransitTo.departure_time,
      //   arrival_time: subSchedule.TransitTo.arrival_time,
      //   journey_time: subSchedule.TransitTo.journey_time
      // } : null,
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
    seatAvailability: {
      id: subSchedule.dataValues.seatAvailability?.id || "N/A",
      available_seats: subSchedule.dataValues.seatAvailability?.available_seats || "N/A",
      date: subSchedule.dataValues.seatAvailability?.date 
        ? new Date(subSchedule.dataValues.seatAvailability.date).toLocaleDateString()  // Format date to readable format
        : "N/A",
    },
  }));
};


module.exports = {
  formatSchedules,
  formatSubSchedules,
};
