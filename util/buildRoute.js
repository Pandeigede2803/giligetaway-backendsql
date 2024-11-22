const buildRoute = (seatAvailability) => {
  let route = '';
  console.log("ini data seatavailability jancuk:", seatAvailability);

  if (seatAvailability && seatAvailability.schedule_id && !seatAvailability.subschedule_id) {
      // Jika hanya ada Schedule
      const destinationFrom = seatAvailability.Schedule?.FromDestination?.name || 'Unknown';
      const transits = seatAvailability.Schedule?.Transits?.map(transit => transit.Destination?.name) || [];
      const destinationTo = seatAvailability.Schedule?.ToDestination?.name || 'Unknown';


      route = `${destinationFrom} - ${transits.length > 0 ? transits.join(' - ') + ' - ' : ''}${destinationTo}`;

  } else if (seatAvailability && seatAvailability.subschedule_id) {
      // Jika ada SubSchedule
      const destinationFromSchedule = seatAvailability.SubSchedule?.DestinationFromSchedule?.name || 'Unknown';
      const transitFrom = seatAvailability.SubSchedule?.TransitFrom?.Destination?.name || 'Unknown';
      const transits = [
        seatAvailability.SubSchedule?.Transit1?.Destination?.name, 
        seatAvailability.SubSchedule?.Transit2?.Destination?.name, 
        seatAvailability.SubSchedule?.Transit3?.Destination?.name, 
        seatAvailability.SubSchedule?.Transit4?.Destination?.name
      ].filter(Boolean);
      const transitTo = seatAvailability.SubSchedule?.TransitTo?.Destination?.name || 'Unknown';
      const destinationToSchedule = seatAvailability.SubSchedule?.DestinationToSchedule?.name || 'Unknown';

      route = `${destinationFromSchedule} - ${transitFrom} - ${transits.join(' - ')} - ${transitTo} - ${destinationToSchedule}`;
  }

  return route;
};

const buildRouteFromSchedule = (schedule, subSchedule) => {
  // Log the schedule and subSchedule that are passed


  let route = '';
  console.log('Schedule passed to buildRouteFromSchedule:', schedule);
  
  // Log detail FromDestination and ToDestination dataValues
  if (schedule && schedule.dataValues.FromDestination) {
    console.log('FromDestination dataValues:', schedule.dataValues.FromDestination.dataValues);
  }
  
  if (schedule && schedule.dataValues.ToDestination) {
    console.log('ToDestination dataValues:', schedule.dataValues.ToDestination.dataValues);
  }

  // Penanganan Schedule Only Case
  if (schedule && !subSchedule) {
    // Ambil FromDestination dan ToDestination dari Schedule
    const destinationFrom = schedule.dataValues.FromDestination?.dataValues.name || 'Unknown';
    const transits = schedule.dataValues.Transits?.map(transit => transit.dataValues.Destination?.dataValues.name) || [];
    const destinationTo = schedule.dataValues.ToDestination?.dataValues.name || 'Unknown';
    console.log('Schedule data:', schedule.dataValues);
    console.log('FROM DESTINATION:', schedule.dataValues.FromDestination?.dataValues);
    console.log('TO DESTINATION:', schedule.dataValues.ToDestination?.dataValues);

    // Gabungkan From, Transit (jika ada), dan To untuk membentuk rute
    route = `${destinationFrom} - ${transits.length > 0 ? transits.join(' - ') + ' - ' : ''}${destinationTo}`;
    
    // Logging rute yang dibentuk menggunakan Schedule ID saja
    console.log(`Route built (Schedule only): From ${destinationFrom} through ${transits.join(', ')} to ${destinationTo}`);
  
  } else if (subSchedule) {
    // Penanganan SubSchedule Case
    const destinationFromSchedule = subSchedule.dataValues.DestinationFrom?.dataValues.name || 'Unknown';
    const transitFrom = subSchedule.dataValues.TransitFrom?.Destination?.dataValues.name || 'Unknown';
    const transits = [
      subSchedule.dataValues.Transit1?.dataValues.Destination?.dataValues.name,
      subSchedule.dataValues.Transit2?.dataValues.Destination?.dataValues.name,
      subSchedule.dataValues.Transit3?.dataValues.Destination?.dataValues.name,
      subSchedule.dataValues.Transit4?.dataValues.Destination?.dataValues.name
    ].filter(Boolean);
    const transitTo = subSchedule.dataValues.TransitTo?.dataValues.Destination?.dataValues.name || 'Unknown';
    const destinationToSchedule = subSchedule.dataValues.DestinationTo?.dataValues.name || 'Unknown';
  // Construct route: Filter out "Unknown" segments and join with " - "
  route = [
    destinationFromSchedule,
    transitFrom,
    ...transits,
    transitTo,
    destinationToSchedule,
  ].filter((segment) => segment !== 'Unknown').join(' - ');




    // Logging rute yang dibentuk menggunakan SubSchedule
    console.log(`Route built (SubSchedule): From ${destinationFromSchedule} through ${transits.join(', ')} to ${destinationToSchedule}`);
  }

  return route;
};



module.exports = { buildRoute, buildRouteFromSchedule };
