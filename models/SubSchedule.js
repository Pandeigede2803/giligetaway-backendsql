const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const SubSchedule = sequelize.define('SubSchedule', {
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
    destination_from_schedule_id: {
        type: DataTypes.INTEGER,
        allowNull: true, // Allow null values
        references: {
            model: 'Schedules',
            key: 'id'
        }
    },
    destination_to_schedule_id: {
        type: DataTypes.INTEGER,
        allowNull: true, // Allow null values
        references: {
            model: 'Schedules',
            key: 'id'
        }
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
    validity_start: {
        type: DataTypes.DATE,
        allowNull: false
    },
    validity_end: {
        type: DataTypes.DATE,
        allowNull: false
    },
    route_image: {
        type: DataTypes.STRING,
        allowNull: true
    },
    availability: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        allowNull: false
    },
    transit_from_id: {
        type: DataTypes.INTEGER,
        allowNull: true, // Allow null values
        references: {
            model: 'Transits',
            key: 'id'
        }
    },
    transit_to_id: {
        type: DataTypes.INTEGER,
        allowNull: true, // Allow null values
        references: {
            model: 'Transits',
            key: 'id'
        }
    },
    transit_1: {
        type: DataTypes.INTEGER,
        allowNull: true, // Allow null values
        references: {
            model: 'Transits',
            key: 'id'
        }
    },
    transit_2: {
        type: DataTypes.INTEGER,
        allowNull: true, // Allow null values
        references: {
            model: 'Transits',
            key: 'id'
        }
    },
    transit_3: {
        type: DataTypes.INTEGER,
        allowNull: true, // Allow null values
        references: {
            model: 'Transits',
            key: 'id'
        }
    },
    transit_4: {
        type: DataTypes.INTEGER,
        allowNull: true, // Allow null values
        references: {
            model: 'Transits',
            key: 'id'
        }
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
    tableName: 'SubSchedules',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

// Define associations
SubSchedule.associate = (models) => {
    SubSchedule.belongsTo(models.Schedule, {
        foreignKey: 'schedule_id',
        as: 'Schedule'
    });

    SubSchedule.belongsTo(models.Transit, {
        foreignKey: 'transit_from_id',
        as: 'TransitFrom'
    });

    SubSchedule.belongsTo(models.Transit, {
        foreignKey: 'transit_to_id',
        as: 'TransitTo'
    });

    SubSchedule.belongsTo(models.Transit, {
        foreignKey: 'transit_1',
        as: 'Transit1'
    });

    SubSchedule.belongsTo(models.Transit, {
        foreignKey: 'transit_2',
        as: 'Transit2'
    });

    SubSchedule.belongsTo(models.Transit, {
        foreignKey: 'transit_3',
        as: 'Transit3'
    });

    SubSchedule.belongsTo(models.Transit, {
        foreignKey: 'transit_4',
        as: 'Transit4'
    });

    SubSchedule.hasMany(models.SeatAvailability, {
        foreignKey: 'subschedule_id',
        as: 'SeatAvailabilities'
    });
    SubSchedule.belongsTo(models.Schedule, {
        foreignKey: 'destination_from_schedule_id',
        as: 'DestinationFrom'
    });

    SubSchedule.belongsTo(models.Schedule, {
        foreignKey: 'destination_to_schedule_id',
        as: 'DestinationTo'
    });

 
};

module.exports = SubSchedule;
