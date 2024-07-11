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
const TransportBooking = require('./TransportBooking');
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
SeatAvailability.belongsTo(Transit, { foreignKey: 'transit_id' });
Schedule.hasMany(SeatAvailability, { foreignKey: 'schedule_id' });
Transit.hasMany(SeatAvailability, { foreignKey: 'transit_id' });
Schedule.belongsTo(Destination, { as: 'DestinationFrom', foreignKey: 'destination_from_id' });
Schedule.belongsTo(Destination, { as: 'DestinationTo', foreignKey: 'destination_to_id' });

Object.keys(models).forEach((modelName) => {
    if ('associate' in models[modelName]) {
        models[modelName].associate(models);
    }
});

models.sequelize = sequelize;
models.Sequelize = Sequelize;

module.exports = models;
