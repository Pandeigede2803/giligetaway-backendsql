// Helper function to build route string from schedule and subschedule
const buildRouteFromSchedule2 = (schedule, subSchedule) => {
  let route = '';
  
  // Ensure that schedule is available
  if (!schedule) {
    return 'Unknown route';
  }

  if (subSchedule) {
  }

  // Handle Schedule Only Case (no SubSchedule)
  if (!subSchedule) {
    const destinationFrom = schedule?.dataValues?.FromDestination?.dataValues?.name || 'Unknown';
    const transits = schedule?.dataValues?.Transits?.map(transit => transit?.dataValues?.Destination?.dataValues?.name).filter(Boolean) || [];
    const destinationTo = schedule?.dataValues?.ToDestination?.dataValues?.name || 'Unknown';

    // Build the route (if transits exist, they are inserted, otherwise it's just from -> to)
    route = `${destinationFrom} - ${transits.length > 0 ? transits.join(' - ') + ' - ' : ''}${destinationTo}`;
  } 
  // Handle SubSchedule Case
  else {
    const destinationFromSchedule = subSchedule?.dataValues?.DestinationFrom?.dataValues?.name || 'Unknown';
    const transitFrom = subSchedule?.dataValues?.TransitFrom?.Destination?.dataValues?.name || 'Unknown';

    // Collect all transit points and filter out any that are undefined or null
    const transits = [
      subSchedule?.dataValues?.Transit1?.Destination?.dataValues?.name,
      subSchedule?.dataValues?.Transit2?.Destination?.dataValues?.name,
      subSchedule?.dataValues?.Transit3?.Destination?.dataValues?.name,
      subSchedule?.dataValues?.Transit4?.Destination?.dataValues?.name
    ].filter(Boolean);

    const transitTo = subSchedule?.dataValues?.TransitTo?.Destination?.dataValues?.name || 'Unknown';
    const destinationToSchedule = subSchedule?.dataValues?.DestinationTo?.dataValues?.name || 'Unknown';

    // Build the route with sub-schedule details
    route = `${destinationFromSchedule} - ${transitFrom} - ${transits.length > 0 ? transits.join(' - ') + ' - ' : ''}${transitTo} - ${destinationToSchedule}`;
  }

  // Return the final built route
  return route;
};



  module.exports = {
    buildRouteFromSchedule2,
  };
