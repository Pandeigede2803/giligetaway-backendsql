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
        },
        allowNull: false,
        field: 'schedule_id'
    },
    available_seats: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'available_seats'
    },
    transit_id: {
        type: DataTypes.INTEGER,
        references: {
            model: 'Transits',
            key: 'id'
        },
        allowNull: true,
        field: 'transit_id'
    },
    subschedule_id: {
        type: DataTypes.INTEGER,
        references: {
            model: 'SubSchedules',
            key: 'id'
        },
        allowNull: true,
        field: 'subschedule_id'
    },
    availability: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        field: 'availability'
    },
    date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        field: 'date'
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
    tableName: 'SeatAvailability',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});
SeatAvailability.associate = (models) => {
    SeatAvailability.belongsTo(models.Schedule, { foreignKey: 'schedule_id' });
    SeatAvailability.belongsTo(models.Transit, { foreignKey: 'transit_id' });
    SeatAvailability.belongsTo(models.SubSchedule, { foreignKey: 'subschedule_id' });

    SeatAvailability.hasMany(models.BookingSeatAvailability, {
        foreignKey: 'seat_availability_id',
        as: 'BookingSeatAvailabilities'
      });
};

module.exports = SeatAvailability;
