// models/waitingList.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const WaitingList = sequelize.define('WaitingList', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    contact_name: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    contact_phone: {
        type: DataTypes.STRING(20),
        allowNull: false
    },
    contact_email: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    schedule_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'Schedules',
            key: 'id'
        }
    },
    subschedule_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'SubSchedules',
            key: 'id'
        }
    },
    seat_availability_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'SeatAvailability',
            key: 'id'
        }
    },
    booking_date: {
        type: DataTypes.DATEONLY,
        allowNull: false
    },
    total_passengers: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    adult_passengers: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
    },
    child_passengers: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
    },
    infant_passengers: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
    },
    status: {
        type: DataTypes.ENUM('pending', 'contacted', 'booked', 'cancelled'),
        allowNull: false,
        defaultValue: 'pending'
    },
    follow_up_notes: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    follow_up_date: {
        type: DataTypes.DATEONLY,
        allowNull: true
    },
    last_contact_date: {
        type: DataTypes.DATE,
        allowNull: true
    },
    created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'WaitingList',
    timestamps: false
});


// Define associations
// Define associations
WaitingList.associate = function(models) {
    WaitingList.belongsTo(models.Schedule, { 
        foreignKey: 'schedule_id',
        as: 'Schedule'
    });
    
    WaitingList.belongsTo(models.SubSchedule, { 
        foreignKey: 'subschedule_id',
        as: 'SubSchedule'
    });
    
    WaitingList.belongsTo(models.SeatAvailability, { 
        foreignKey: 'seat_availability_id',
        as: 'SeatAvailability'
    });
};

module.exports = WaitingList;;