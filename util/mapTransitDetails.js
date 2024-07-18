// utils.js

// Helper function to map transit details
// Helper function to map transit details
const mapTransitDetails = (transitDetail) => {
  const {
    Schedule,
    TransitFrom,
    TransitTo,
    Transit1,
    Transit2,
    Transit3,
    Transit4,
    DestinationFromSchedule,
    DestinationToSchedule,
    ...rest
  } = transitDetail.get({ plain: true });

  return {
    ...rest,
    Schedule: {
      ...Schedule,
      destinationFrom: DestinationFromSchedule ? DestinationFromSchedule.name : 'N/A',
      destinationTo: DestinationToSchedule ? DestinationToSchedule.name : 'N/A',
    },
    TransitFrom: {
      ...TransitFrom,
      name: TransitFrom ? TransitFrom.Destination.name : 'N/A',
    },
    TransitTo: {
      ...TransitTo,
      name: TransitTo ? TransitTo.Destination.name : 'N/A',
    },
    Transit1: {
      ...Transit1,
      name: Transit1 ? Transit1.Destination.name : 'N/A',
    },
    Transit2: {
      ...Transit2,
      name: Transit2 ? Transit2.Destination.name : 'N/A',
    },
    Transit3: {
      ...Transit3,
      name: Transit3 ? Transit3.Destination.name : 'N/A',
    },
    Transit4: {
      ...Transit4,
      name: Transit4 ? Transit4.Destination.name : 'N/A',
    },
    DestinationFromSchedule: {
      ...DestinationFromSchedule,
      name: DestinationFromSchedule ? DestinationFromSchedule.name : 'N/A',
    },
    DestinationToSchedule: {
      ...DestinationToSchedule,
      name: DestinationToSchedule ? DestinationToSchedule.name : 'N/A',
    },
  };
};

  module.exports = {
    mapTransitDetails
  };
  