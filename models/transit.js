const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Transit = sequelize.define('Transit', {
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
    destination_id: {
        type: DataTypes.INTEGER,
        references: {
            model: 'Destinations',
            key: 'id'
        }
    },
    check_in_time: {
        type: DataTypes.TIME,
        allowNull: true
    },
    departure_time: {
        type: DataTypes.TIME,
        allowNull: true
    },
    arrival_time: {  // Kolom baru untuk arrival_time
        type: DataTypes.TIME,
        allowNull: true
    },
    journey_time: {
        type: DataTypes.TIME,
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
    tableName: 'Transits',
    timestamps: false
});

Transit.associate = (models) => {
    Transit.belongsTo(models.Schedule, {
        foreignKey: 'schedule_id',
        as: 'Schedule',
    });
    Transit.belongsTo(models.Destination, {
        as: 'Destination',
        foreignKey: 'destination_id'
    });
    Transit.hasMany(models.SeatAvailability, {
        foreignKey: 'transit_id',
        as: 'SeatAvailabilities'
        
    }); 
};

module.exports = Transit;
