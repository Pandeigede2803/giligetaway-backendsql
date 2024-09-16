const { sequelize, Booking, SeatAvailability,Destination,Transport, Schedule,SubSchedule,Transaction, Passenger,Transit, TransportBooking, AgentMetrics, Agent, BookingSeatAvailability, Boat } = require('../models');

const sumTotalPassengers = (bookingSeatAvailabilities) => {
    return bookingSeatAvailabilities.reduce((total, bookingSeatAvailability) => {
      return total + (bookingSeatAvailability.Booking?.total_passengers || 0);
    }, 0);
  };

  module.exports = { sumTotalPassengers }