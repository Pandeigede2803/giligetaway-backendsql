const sequelize = require('../config/database');
const { Sequelize, DataTypes } = require('sequelize');

const User = require('./user');
const Boat = require('./boat');
const Destination = require('./destination');
const Schedule = require('./schedule');
const Transport = require('./transport');
const Transit = require('./transit');
const Agent = require('./agent');
const Booking = require('./booking');
const Passenger = require('./passenger');
const AgentMetrics = require('./agentMetrics');
const TransportBooking = require('./transportBooking');
const SeatAvailability = require('./seatAvailability');

const models = {
    User,
    Boat,
    Destination,
    Schedule,
    Transport,
    Transit,
    Agent,
    Booking,
    Passenger,
    AgentMetrics,
    TransportBooking,
    SeatAvailability
};

// Associations
Booking.hasMany(TransportBooking, { foreignKey: 'booking_id' });
Transport.hasMany(TransportBooking, { foreignKey: 'transport_id' });
TransportBooking.belongsTo(Booking, { foreignKey: 'booking_id' });
TransportBooking.belongsTo(Transport, { foreignKey: 'transport_id' });
SeatAvailability.belongsTo(Schedule, { foreignKey: 'schedule_id' });
Schedule.hasMany(SeatAvailability, { foreignKey: 'schedule_id' });

Object.keys(models).forEach((modelName) => {
    if ('associate' in models[modelName]) {
        models[modelName].associate(models);
    }
});

models.sequelize = sequelize;
models.Sequelize = Sequelize;

module.exports = models;
