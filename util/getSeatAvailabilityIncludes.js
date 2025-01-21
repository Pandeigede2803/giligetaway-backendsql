const { sequelize, Booking, SeatAvailability,Destination,Transport, Schedule,SubSchedule,Transaction, Passenger,Transit, TransportBooking, AgentMetrics, Agent, BookingSeatAvailability, Boat } = require('../models');

const getSeatAvailabilityIncludes = () => {
    return [
      {
        model: BookingSeatAvailability,
        as: 'BookingSeatAvailabilities',
        attributes: ['id','booking_id'],
        include: [
          {
            model: Booking,
            as: 'Booking',
            where: { 
              payment_status: ['paid','invoiced',"pending"]
             },
            attributes: ['total_passengers']
          }
        ]
      },
      {
        model: Schedule,
        as: 'Schedule',
        include: [
          {
            model: Destination,
            as: 'FromDestination',
            attributes: ['name']
          },
          {
            model: Destination,
            as: 'ToDestination',
            attributes: ['name']
          },
          {
            model: Transit,
            as: 'Transits',
            include: [
              {
                model: Destination,
                as: 'Destination',
                attributes: ['name']
              }
            ]
          }
        ]
      },
      {
        model: SubSchedule,
        as: 'SubSchedule',
        include: [
          {
            model: Destination,
            as: 'DestinationFrom',
            attributes: ['name']
          },
          {
            model: Transit,
            as: 'TransitFrom',
            include: [
              {
                model: Destination,
                as: 'Destination',
                attributes: ['name']
              }
            ]
          },
          {
            model: Transit,
            as: 'Transit1',
            include: [
              {
                model: Destination,
                as: 'Destination',
                attributes: ['name']
              }
            ]
          },
          {
            model: Transit,
            as: 'Transit2',
            include: [
              {
                model: Destination,
                as: 'Destination',
                attributes: ['name']
              }
            ]
          },
          {
            model: Transit,
            as: 'Transit3',
            include: [
              {
                model: Destination,
                as: 'Destination',
                attributes: ['name']
              }
            ]
          },
          {
            model: Transit,
            as: 'Transit4',
            include: [
              {
                model: Destination,
                as: 'Destination',
                attributes: ['name']
              }
            ]
          },
          {
            model: Transit,
            as: 'TransitTo',
            include: [
              {
                model: Destination,
                as: 'Destination',
                attributes: ['name']
              }
            ]
          },
          {
            model: Destination,
            as: 'DestinationTo',
            attributes: ['name']
          }
        ]
      }
    ];
  };
  

//   export
module.exports = getSeatAvailabilityIncludes;