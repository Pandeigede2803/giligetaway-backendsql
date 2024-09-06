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
// import transaction 
const Transaction = require('./Transaction');

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
    SubSchedule,
    AgentCommission,
    Transaction
};

// Associations
Object.keys(models).forEach(modelName => {
    if ('associate' in models[modelName]) {
        models[modelName].associate(models);
    }
});

// Additional associations
Booking.hasMany(TransportBooking, { foreignKey: 'booking_id' });
TransportBooking.belongsTo(Booking, { foreignKey: 'booking_id' });
TransportBooking.belongsTo(Transport, { foreignKey: 'transport_id' });

// Associations for seat availability
SeatAvailability.belongsTo(Schedule, { foreignKey: 'schedule_id' });
SeatAvailability.belongsTo(Transit, { foreignKey: 'transit_id' });
SeatAvailability.belongsTo(SubSchedule, { foreignKey: 'subschedule_id' });

// Schedule associations
Schedule.hasMany(SeatAvailability, { foreignKey: 'schedule_id' });

// Transit associations
Transit.hasMany(SeatAvailability, { foreignKey: 'transit_id' });

// Subschedule associations
SubSchedule.hasMany(SeatAvailability, { foreignKey: 'subschedule_id' });

// Destination associations
Schedule.belongsTo(Destination, { as: 'DestinationFrom', foreignKey: 'destination_from_id' });
Schedule.belongsTo(Destination, { as: 'DestinationTo', foreignKey: 'destination_to_id' });

// Booking and SeatAvailability Many-to-Many associations
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

// Transaction associations
// Booking.hasMany(Transaction, { foreignKey: 'booking_id' });
// Transaction.belongsTo(Booking, { foreignKey: 'booking_id' });


// BookingSeatAvailability associations
BookingSeatAvailability.belongsTo(Booking, { foreignKey: 'booking_id',  });
BookingSeatAvailability.belongsTo(SeatAvailability, { foreignKey: 'seat_availability_id',});


models.sequelize = sequelize;
models.Sequelize = Sequelize;

module.exports = models;