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
const SeatAvailability = require('./SeatAvailability');
const BookingSeatAvailability = require('./BookingSeatAvailability');;
const SubSchedule = require('./SubSchedule'); // Tambahkan model baru
const AgentCommission = require('./AgentComission');

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
    SeatAvailability,
    BookingSeatAvailability,
    SubSchedule, // Tambahkan model baru
    AgentCommission
};

// Associations
Object.keys(models).forEach((modelName) => {
    if ('associate' in models[modelName]) {
        models[modelName].associate(models);
    }
});

Booking.hasMany(TransportBooking, { foreignKey: 'booking_id' });
// Transport.hasMany(TransportBooking, { foreignKey: 'transport_id' });
TransportBooking.belongsTo(Booking, { foreignKey: 'booking_id' });
TransportBooking.belongsTo(Transport, { foreignKey: 'transport_id' });


// Associations seat availability
SeatAvailability.belongsTo(Schedule, { foreignKey: 'schedule_id' });
SeatAvailability.belongsTo(Transit, { foreignKey: 'transit_id' });
SeatAvailability.belongsTo(SubSchedule, { foreignKey: 'subschedule_id' }); // Tambahkan asosiasi

// schedule
Schedule.hasMany(SeatAvailability, { foreignKey: 'schedule_id' });

// transit
Transit.hasMany(SeatAvailability, { foreignKey: 'transit_id' });

// subschedule
SubSchedule.hasMany(SeatAvailability, { foreignKey: 'subschedule_id' }); // Tambahkan asosiasi

// Destination
Schedule.belongsTo(Destination, { as: 'DestinationFrom', foreignKey: 'destination_from_id' });
Schedule.belongsTo(Destination, { as: 'DestinationTo', foreignKey: 'destination_to_id' });


Booking.belongsToMany(SeatAvailability, {
    through: BookingSeatAvailability,
    foreignKey: 'booking_id',
    otherKey: 'seat_availability_id'
});

SeatAvailability.belongsToMany(Booking, {
    through: BookingSeatAvailability,
    foreignKey: 'seat_availability_id',
    otherKey: 'booking_id'
});

models.sequelize = sequelize;
models.Sequelize = Sequelize;

module.exports = models;
