const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const SeatAvailability = require('./SeatAvailability'); // Import model SeatAvailability


const Schedule = sequelize.define('Schedule', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    boat_id: {
        type: DataTypes.INTEGER,
        references: {
            model: 'Boats',
            key: 'id'
        }
    },
    destination_from_id: {
        type: DataTypes.INTEGER,
        references: {
            model: 'Destinations',
            key: 'id'
        }
    },
    destination_to_id: {
        type: DataTypes.INTEGER,
        references: {
            model: 'Destinations',
            key: 'id'
        }
    },
    user_id: {
        type: DataTypes.INTEGER,
        references: {
            model: 'Users',
            key: 'id'
        }
    },
    validity_start: {
        type: DataTypes.DATE,
        allowNull: false
    },
    validity_end: {
        type: DataTypes.DATE,
        allowNull: false
    },
    check_in_time: {
        type: DataTypes.TIME,
        allowNull: false
    },
    departure_time: {
        type: DataTypes.TIME,
        allowNull: false
    },
    low_season_price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    },
    high_season_price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    },
    peak_season_price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    },
    return_low_season_price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    },
    return_high_season_price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    },
    return_peak_season_price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    },

    availability: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        allowNull: false
    },
    arrival_time: {
        type: DataTypes.TIME,
        allowNull: false
    },
    journey_time: {
        type: DataTypes.TIME,
        allowNull: false
    },
    route_image: {
        type: DataTypes.STRING,
        allowNull: true
    },
    schedule_type: {
        type: DataTypes.STRING,
        allowNull: true
    },
    days_of_week: {
        type: DataTypes.TINYINT.UNSIGNED,
       
        allowNull: false,
    },
    trip_type: {
        type: DataTypes.ENUM('mid', 'short', 'long', 'intermediate'),
        allowNull: false,
    },
    created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        onUpdate: DataTypes.NOW
    }
}, {
    tableName: 'Schedules',
    timestamps: false
});

// Define associations
Schedule.associate = (models) => {

    Schedule.belongsTo(models.Boat, {
        foreignKey: 'boat_id',
        as: 'Boat'
    });
    Schedule.belongsTo(models.Destination, {
        as: 'FromDestination',
        foreignKey: 'destination_from_id'
    });
    Schedule.belongsTo(models.Destination, {
        as: 'ToDestination',
        foreignKey: 'destination_to_id'
    });
    Schedule.hasMany(models.Transit, {
        foreignKey: 'schedule_id'
    });
    Schedule.hasMany(models.SubSchedule, {
        foreignKey: 'schedule_id',
        as: 'SubSchedules'
    });
    Schedule.hasMany(models.Booking, {
        foreignKey: 'schedule_id',
        as: 'Bookings'
    });
    Schedule.hasMany(SeatAvailability, {
        foreignKey: 'schedule_id',
        as: 'SeatAvailabilities'
    });
 


    
};

module.exports = Schedule;
