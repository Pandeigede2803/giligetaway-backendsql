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
const SubScheduleRelation = require('./SubscheduleRelation')
const WaitingList = require('./WaitingList');
// ... other model imports
// import transaction 
const Transaction = require('./Transaction');
const BulkBookingResult = require('./BulkBookingResult');
const BulkBookingUpload = require('./BulkBookingUpload');
const Discount = require('./discount');


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
    Transaction,
    SubScheduleRelation,
    Discount,
    WaitingList,BulkBookingResult,BulkBookingUpload
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


SubSchedule.hasMany(SubScheduleRelation, {
    as: 'MainRelations',  // SubSchedule has many relations where it's the main schedule
    foreignKey: 'main_subschedule_id'
});

SubSchedule.hasMany(SubScheduleRelation, {
    as: 'RelatedRelations',  // SubSchedule has many relations where it's the related schedule
    foreignKey: 'related_subschedule_id'
});

// From SubScheduleRelation to SubSchedule (with UNIQUE aliases)
SubScheduleRelation.belongsTo(SubSchedule, {
    as: 'MainSchedule',  // Changed from 'MainSubSchedule' to avoid duplicate
    foreignKey: 'main_subschedule_id'
});

SubScheduleRelation.belongsTo(SubSchedule, {
    as: 'RelatedSchedule',  // Changed from 'RelatedSubSchedule' to be consistent
    foreignKey: 'related_subschedule_id'
});
// Transaction associations
// Booking.hasMany(Transaction, { foreignKey: 'booking_id' });
// Transaction.belongsTo(Booking, { foreignKey: 'booking_id' });


// Add these lines at the bottom of your associations section in index.js

// WaitingList associations
// WaitingList associations
WaitingList.belongsTo(Schedule, { 
    foreignKey: 'schedule_id',
    as: 'WaitingSchedule'
});

WaitingList.belongsTo(SubSchedule, { 
    foreignKey: 'subschedule_id',
    as: 'WaitingSubSchedule'
});

WaitingList.belongsTo(SeatAvailability, { 
    foreignKey: 'seat_availability_id',
    as: 'WaitingSeatAvailability'
});


// Inverse associations
Schedule.hasMany(WaitingList, { 
    foreignKey: 'schedule_id',
    as: 'WaitingLists'
});

SubSchedule.hasMany(WaitingList, { 
    foreignKey: 'subschedule_id',
    as: 'WaitingLists'
});

SeatAvailability.hasMany(WaitingList, { 
    foreignKey: 'seat_availability_id',
    as: 'WaitingLists'
});
// BookingSeatAvailability associations
BookingSeatAvailability.belongsTo(Booking, { foreignKey: 'booking_id',  });
BookingSeatAvailability.belongsTo(SeatAvailability, { foreignKey: 'seat_availability_id',});






models.sequelize = sequelize;
models.Sequelize = Sequelize;

module.exports = models;