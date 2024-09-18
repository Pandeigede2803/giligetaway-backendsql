const buildRoute = (seatAvailability) => {
  let route = '';

  if (seatAvailability && seatAvailability.schedule_id && !seatAvailability.subschedule_id) {
      // Schedule only case
      const destinationFrom = seatAvailability.Schedule?.DestinationFrom?.name || 'Unknown';
      const transits = seatAvailability.Schedule?.Transits?.map(transit => transit.Destination?.name) || [];
      route = `${destinationFrom} - ${transits.join(' - ')}`;
  } else if (seatAvailability && seatAvailability.subschedule_id) {
      // SubSchedule case
      const destinationFromSchedule = seatAvailability.SubSchedule?.DestinationFromSchedule?.name || 'Unknown';
      const transitFrom = seatAvailability.SubSchedule?.TransitFrom?.Destination?.name || 'Unknown';
      const transits = [seatAvailability.SubSchedule?.Transit1?.Destination?.name, 
                        seatAvailability.SubSchedule?.Transit2?.Destination?.name, 
                        seatAvailability.SubSchedule?.Transit3?.Destination?.name, 
                        seatAvailability.SubSchedule?.Transit4?.Destination?.name].filter(Boolean);
      const transitTo = seatAvailability.SubSchedule?.TransitTo?.Destination?.name || 'Unknown';
      const destinationToSchedule = seatAvailability.SubSchedule?.DestinationToSchedule?.name || 'Unknown';

      route = `${destinationFromSchedule} - ${transitFrom} - ${transits.join(' - ')} - ${transitTo} - ${destinationToSchedule}`;
  }

  return route;
};


const buildRouteFromSchedule = (schedule, subSchedule) => {
  let route = '';

  if (schedule && !subSchedule) {
      // Schedule only case
      const destinationFrom = schedule.dataValues.FromDestination?.dataValues.name || 'Unknown';
      const transits = schedule.dataValues.Transits?.map(transit => transit.dataValues.Destination?.dataValues.name) || [];
      const destinationTo = schedule.dataValues.ToDestination?.dataValues.name || 'Unknown';
      route = `${destinationFrom} - ${transits.join(' - ')} - ${destinationTo}`;
  } else if (subSchedule) {
      // SubSchedule case
      const destinationFromSchedule = subSchedule.dataValues.DestinationFrom?.dataValues.name || 'Unknown';
      const transitFrom = subSchedule.dataValues.TransitFrom?.dataValues.Destination?.dataValues.name || 'Unknown';
      const transits = [
        subSchedule.dataValues.Transit1?.dataValues.Destination?.dataValues.name,
        subSchedule.dataValues.Transit2?.dataValues.Destination?.dataValues.name,
        subSchedule.dataValues.Transit3?.dataValues.Destination?.dataValues.name,
        subSchedule.dataValues.Transit4?.dataValues.Destination?.dataValues.name
      ].filter(Boolean); // Only keep non-null values
      const transitTo = subSchedule.dataValues.TransitTo?.dataValues.Destination?.dataValues.name || 'Unknown';
      const destinationToSchedule = subSchedule.dataValues.DestinationTo?.dataValues.name || 'Unknown';

      route = `${destinationFromSchedule} - ${transitFrom} - ${transits.join(' - ')} - ${transitTo} - ${destinationToSchedule}`;
  }

  return route;
};


module.exports = { buildRoute, buildRouteFromSchedule };
