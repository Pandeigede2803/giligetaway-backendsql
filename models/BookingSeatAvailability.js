const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const BookingSeatAvailability = sequelize.define('BookingSeatAvailability', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    booking_id: {
        type: DataTypes.INTEGER,
        references: {
            model: 'Bookings',
            key: 'id'
        },
        allowNull: false
    },
    seat_availability_id: {
        type: DataTypes.INTEGER,
        references: {
            model: 'SeatAvailability',
            key: 'id'
        },
        allowNull: false
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
    tableName: 'BookingSeatAvailability',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = BookingSeatAvailability;