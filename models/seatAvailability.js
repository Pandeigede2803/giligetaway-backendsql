const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const SeatAvailability = sequelize.define('SeatAvailability', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    schedule_id: {
        type: DataTypes.INTEGER,
        references: {
            model: 'Schedules',
            key: 'id'
        }
    },
    transit_id: {
        type: DataTypes.INTEGER,
        references: {
            model: 'Transits',
            key: 'id'
        },
        allowNull: true
    },
    available_seats: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    date: {
        type: DataTypes.DATEONLY,
        allowNull: false
    }
}, {
    tableName: 'SeatAvailability',
    timestamps: false
});

SeatAvailability.associate = (models) => {
    SeatAvailability.belongsTo(models.Schedule, {
        foreignKey: 'schedule_id'
    });
    SeatAvailability.belongsTo(models.Transit, {
        foreignKey: 'transit_id'
    });
    SeatAvailability.belongsToMany(models.Booking, {
        through: 'BookingSeatAvailability',
        foreignKey: 'seat_availability_id'
    });
};

module.exports = SeatAvailability;
