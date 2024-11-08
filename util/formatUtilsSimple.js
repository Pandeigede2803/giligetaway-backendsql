/**
 * Format schedules without seat availability and pricing information.
 * @param {Array} schedules - The array of schedule objects.
 * @returns {Array} - Formatted schedules.
 */

const getDayNamesFromBitmask = (bitmask) => {
    const days = [
      "Sunday",    // 0
      "Monday",    // 1
      "Tuesday",   // 2
      "Wednesday", // 3
      "Thursday",  // 4
      "Friday",    // 5
      "Saturday",  // 6
    ];
  
    const selectedDays = [];
  
    for (let i = 0; i < 7; i++) {
      if (bitmask & (1 << i)) {
        selectedDays.push(days[i]);
      }
    }
  
    return selectedDays;;
  };
const formatSchedulesSimple = (schedules) => {
  console.log("this is formatSchedulesSimple", schedules);
  return schedules.map((schedule) => {
    // Extract the names of transit destinations
    const transitDestinationNames = schedule.Transits.map(
      (transit) => transit.Destination?.name || "N/A"
    );

    // Build the main_route string
    const mainRouteArray = [
      schedule.FromDestination?.name || "N/A",
      ...transitDestinationNames,
      schedule.ToDestination?.name || "N/A",
    ];
    const mainRoute = mainRouteArray.join(" - ");

    return {
      id: schedule.id,
      from: schedule.FromDestination?.name || "N/A",
      to: schedule.ToDestination?.name || "N/A",
      transits: schedule.Transits.map((transit) => ({
        destination: transit.Destination?.name || "N/A",
        departure_time: transit.departure_time,
        arrival_time: transit.arrival_time,
        journey_time: transit.journey_time,
      })),
      main_route: mainRoute,
      route_image: schedule.route_image || "N/A",
      departure_time: schedule.departure_time || "N/A",
      arrival_time: schedule.arrival_time || "N/A",
      journey_time: schedule.journey_time || "N/A",
      check_in_time: schedule.check_in_time || "N/A",
      boat_id: schedule.Boat?.id || "N/A",
      low_season_price: schedule.low_season_price || "N/A",
      high_season_price: schedule.high_season_price || "N/A",
      peak_season_price: schedule.peak_season_price || "N/A",
      days_of_week: schedule.days_of_week
        ? getDayNamesFromBitmask(schedule.days_of_week)
        : "N/A", // Convert bitmask to day names
      validity:
        schedule.validity_start && schedule.validity_end
          ? `${schedule.validity_start} to ${schedule.validity_end}`
          : "N/A",
    };
  });
};

  /**
   * Format subschedules without seat availability and pricing information.
   * @param {Array} subSchedules - The array of subschedule objects.
   * @returns {Array} - Formatted subschedules.
   */
  const formatSubSchedulesSimple = (subSchedules) => {
    console.log("this is formatSubSchedulesSimple", subSchedules)
    return subSchedules.map((subSchedule) => {
      // Determine if TransitFrom or TransitTo exists
      const hasTransitFrom = !!subSchedule.TransitFrom;
      const hasTransitTo = !!subSchedule.TransitTo;
  
      // Get departure_time and check_in_time from TransitFrom or Schedule
      const departure_time = hasTransitFrom
        ? subSchedule.TransitFrom.departure_time
        : subSchedule.Schedule?.departure_time || "N/A";
  
      const check_in_time = hasTransitFrom
        ? subSchedule.TransitFrom.check_in_time
        : subSchedule.Schedule?.check_in_time || "N/A";
  
      // Get arrival_time and journey_time from TransitTo or Schedule
      const arrival_time = hasTransitTo
        ? subSchedule.TransitTo.arrival_time
        : subSchedule.Schedule?.arrival_time || "N/A";
  
      const journey_time = hasTransitTo
        ? subSchedule.TransitTo.journey_time
        : subSchedule.Schedule?.journey_time || "N/A";
  
      // Get route_image from Schedule
      const route_image = subSchedule.Schedule?.route_image || "N/A";
  
      return {
        id: subSchedule.id,
        schedule_id: subSchedule.Schedule?.id || "N/A",
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
        route_image, // Get from associated Schedule
        departure_time, // Computed departure_time
        check_in_time, // Computed check_in_time
        arrival_time, // Computed arrival_time
        journey_time, // Computed journey_time
        boat_id: subSchedule.Schedule?.Boat?.id || "N/A",
        low_season_price: subSchedule.low_season_price || "N/A",
        high_season_price: subSchedule.high_season_price || "N/A",
        peak_season_price: subSchedule.peak_season_price || "N/A",
        validity: subSchedule.validity_start && subSchedule.validity_end
        ? `${subSchedule.validity_start} to ${subSchedule.validity_end}`
        : "N/A",
        days_of_week: subSchedule.days_of_week
        ? getDayNamesFromBitmask(subSchedule.days_of_week)
        : "N/A", // Convert bitmask to day names
      
      };
    });
  };
  
  
  module.exports = {
    formatSchedulesSimple,
    formatSubSchedulesSimple,
    getDayNamesFromBitmask
  };
  