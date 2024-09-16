const { sequelize, Booking, SeatAvailability,Destination,Transport, Schedule,SubSchedule,Transaction, Passenger,Transit, TransportBooking, AgentMetrics, Agent, BookingSeatAvailability, Boat } = require('../models');

const buildRoute = (seatAvailability) => {
    let route = '';
  
    if (seatAvailability.schedule_id && !seatAvailability.subschedule_id) {
      // Schedule only case
      const destinationFrom = seatAvailability.Schedule?.DestinationFrom?.name || 'Unknown';
      const transits = seatAvailability.Schedule?.Transits?.map(transit => transit.Destination?.name) || [];
      route = `${destinationFrom} - ${transits.join(' - ')}`;
    } else if (seatAvailability.subschedule_id) {
      // SubSchedule case
      const destinationFromSchedule = seatAvailability.SubSchedule?.DestinationFromSchedule?.name || 'Unknown';
      const transitFrom = seatAvailability.SubSchedule?.TransitFrom?.Destination?.name || 'Unknown';
      const transit1 = seatAvailability.SubSchedule?.Transit1?.Destination?.name || '';
      const transit2 = seatAvailability.SubSchedule?.Transit2?.Destination?.name || '';
      const transit3 = seatAvailability.SubSchedule?.Transit3?.Destination?.name || '';
      const transit4 = seatAvailability.SubSchedule?.Transit4?.Destination?.name || '';
      const transitTo = seatAvailability.SubSchedule?.TransitTo?.Destination?.name || 'Unknown';
      const destinationToSchedule = seatAvailability.SubSchedule?.DestinationToSchedule?.name || 'Unknown';
  
      route = `${destinationFromSchedule} / ${transitFrom} / ${[transit1, transit2, transit3, transit4].filter(Boolean).join(' - ')} / ${transitTo} / ${destinationToSchedule}`;
    }
  
    return route;
  };
  

  module.exports = { buildRoute };