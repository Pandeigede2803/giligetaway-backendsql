const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Passenger = sequelize.define('Passenger', {
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
        }
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    nationality: {
        type: DataTypes.STRING,
        allowNull: true
    },
    passport_id: {
        type: DataTypes.STRING,
        allowNull: true
    },
    passenger_type: { // e.g., adult, child, infant
        type: DataTypes.STRING,
        allowNull: false
    },
    seat_number: {
        type: DataTypes.STRING,
        allowNull: true
    },
    note: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        field: 'created_at'
    },
    updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        field: 'updated_at'
    }
}, {
    tableName: 'Passengers',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

Passenger.associate = (models) => {
    Passenger.belongsTo(models.Booking, {
        foreignKey: 'booking_id',
        as: 'booking'
    });
};

module.exports = Passenger;
